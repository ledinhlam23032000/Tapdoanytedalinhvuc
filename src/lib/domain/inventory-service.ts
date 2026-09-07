import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCompanyContextForActor } from "@/lib/authorization/company-context";
import { AuthorizationError } from "@/lib/authorization/errors";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import {
  assertSameCompanyOrganizationUnit,
  assertSameCompanyCatalogItem,
  assertSameCompanyInventoryItem,
  assertSameCompanyInventoryLocation,
} from "@/lib/domain/scope-guards";
import { createApprovalRequest, firstApproveRequest, secondApproveRequest, rejectApprovalRequest } from "@/lib/domain/approval-service";
import {
  calculateStockBalance,
  wouldResultInNegativeBalance,
  type StockMovementLike,
  type StockMovementType,
} from "@/lib/domain/stock-balance";
import type { Prisma, InventoryItem, InventoryLocationType, StockMovementSourceType } from "@/generated/prisma";

// Domain service — Inventory (InventoryItem + InventoryLocation +
// StockMovement + INVENTORY_ADJUSTMENT qua ApprovalRequest 2 người). Master
// Prompt Phần 6. Số dư tồn kho KHÔNG có cột lưu trữ — luôn derive qua
// stock-balance.ts (ADR-031); StockMovement.quantity LUÔN dương, chiều
// nhập/xuất suy từ `type` (ADR-032).

function toMovementLikes(movements: { type: StockMovementType; quantity: unknown }[]): StockMovementLike[] {
  return movements.map((m) => ({ type: m.type, quantity: Number(m.quantity) }));
}

// ===== InventoryItem =====

const createInventoryItemSchema = z.object({
  companyId: z.string().min(1),
  catalogItemId: z.string().min(1).optional(),
  sku: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(200),
  unit: z.string().trim().min(1).max(50),
  trackStock: z.boolean().optional(),
  reorderLevel: z.number().nonnegative().optional(),
});

export async function createInventoryItem(actorId: string, input: z.input<typeof createInventoryItemSchema>) {
  const parsed = createInventoryItemSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "inventory.manage");
  if (parsed.catalogItemId) await assertSameCompanyCatalogItem(company.id, parsed.catalogItemId);

  return db.$transaction(async (tx) => {
    const item = await tx.inventoryItem.create({
      data: {
        companyId: company.id,
        catalogItemId: parsed.catalogItemId,
        sku: parsed.sku,
        name: parsed.name,
        unit: parsed.unit,
        trackStock: parsed.trackStock,
        reorderLevel: parsed.reorderLevel,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.INVENTORY_ITEM_CREATED,
      targetType: "InventoryItem",
      targetId: item.id,
      companyId: company.id,
      metadata: { name: item.name, sku: item.sku ?? undefined },
    });
    return item;
  });
}

const updateInventoryItemSchema = z.object({
  companyId: z.string().min(1),
  inventoryItemId: z.string().min(1),
  name: z.string().trim().min(1).max(200).optional(),
  unit: z.string().trim().min(1).max(50).optional(),
  trackStock: z.boolean().optional(),
  reorderLevel: z.number().nonnegative().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
});

export async function updateInventoryItem(actorId: string, input: z.input<typeof updateInventoryItemSchema>) {
  const parsed = updateInventoryItemSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "inventory.manage");
  await assertSameCompanyInventoryItem(company.id, parsed.inventoryItemId);

  return db.$transaction(async (tx) => {
    // Prisma bỏ qua các key có giá trị undefined trong update — chỉ field
    // thực sự được actor truyền mới bị ghi đè.
    const item = await tx.inventoryItem.update({
      where: { id: parsed.inventoryItemId },
      data: {
        name: parsed.name,
        unit: parsed.unit,
        trackStock: parsed.trackStock,
        reorderLevel: parsed.reorderLevel,
        status: parsed.status,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.INVENTORY_ITEM_UPDATED,
      targetType: "InventoryItem",
      targetId: item.id,
      companyId: company.id,
      metadata: { name: item.name, status: item.status },
    });
    return item;
  });
}

// ===== InventoryLocation =====

const createInventoryLocationSchema = z.object({
  companyId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  type: z.enum(["WAREHOUSE", "BRANCH", "STORAGE"]).optional(),
  organizationUnitId: z.string().min(1).optional(),
});

export async function createInventoryLocation(actorId: string, input: z.input<typeof createInventoryLocationSchema>) {
  const parsed = createInventoryLocationSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "inventory.manage");
  if (parsed.organizationUnitId) await assertSameCompanyOrganizationUnit(company.id, parsed.organizationUnitId);

  return db.$transaction(async (tx) => {
    const location = await tx.inventoryLocation.create({
      data: {
        companyId: company.id,
        name: parsed.name,
        type: parsed.type as InventoryLocationType | undefined,
        organizationUnitId: parsed.organizationUnitId,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.INVENTORY_LOCATION_CREATED,
      targetType: "InventoryLocation",
      targetId: location.id,
      companyId: company.id,
      metadata: { name: location.name, type: location.type },
    });
    return location;
  });
}

// ===== StockMovement — receive / issue / transfer =====

const receiveStockSchema = z.object({
  companyId: z.string().min(1),
  inventoryItemId: z.string().min(1),
  locationId: z.string().min(1),
  quantity: z.number().positive(),
  occurredAt: z.coerce.date().optional(),
  reason: z.string().trim().min(1).max(2000).optional(),
  sourceType: z.enum(["SALE", "MANUAL", "ADJUSTMENT", "TRANSFER", "PROCEDURE_MATERIAL_USAGE"]).optional(),
  sourceId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1).max(200).optional(),
});

export async function receiveStock(actorId: string, input: z.input<typeof receiveStockSchema>) {
  const parsed = receiveStockSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "inventory.receive");
  await assertSameCompanyInventoryItem(company.id, parsed.inventoryItemId);
  await assertSameCompanyInventoryLocation(company.id, parsed.locationId);

  return db.$transaction(async (tx) => {
    const movement = await tx.stockMovement.create({
      data: {
        companyId: company.id,
        inventoryItemId: parsed.inventoryItemId,
        locationId: parsed.locationId,
        type: "IN",
        quantity: parsed.quantity,
        occurredAt: parsed.occurredAt ?? new Date(),
        sourceType: (parsed.sourceType ?? "MANUAL") as StockMovementSourceType,
        sourceId: parsed.sourceId,
        reason: parsed.reason,
        idempotencyKey: parsed.idempotencyKey,
        actorUserId: actor.id,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.STOCK_RECEIVED,
      targetType: "StockMovement",
      targetId: movement.id,
      companyId: company.id,
      metadata: { inventoryItemId: parsed.inventoryItemId, locationId: parsed.locationId, quantity: parsed.quantity },
    });
    return movement;
  });
}

const issueStockSchema = receiveStockSchema;

export async function issueStock(actorId: string, input: z.input<typeof issueStockSchema>) {
  const parsed = issueStockSchema.parse(input);
  const { actor, company, permissions } = await requireCompanyContextForActor(actorId, parsed.companyId, "inventory.issue");
  await assertSameCompanyInventoryItem(company.id, parsed.inventoryItemId);
  await assertSameCompanyInventoryLocation(company.id, parsed.locationId);

  return db.$transaction(async (tx) => {
    // Khoá row InventoryItem rồi tính số dư NGAY TRONG transaction — check
    // ngoài transaction (bản cũ) không chặn được 2 lần issueStock đồng thời
    // cho cùng item+location: cả hai đọc cùng baseline trước khi bên nào
    // commit, cả hai pass check rồi cùng ghi OUT, đẩy số dư âm ngoài ý muốn
    // dù không ai bấm "cho phép âm kho" (phát hiện qua adversarial review).
    // Lock ở cấp InventoryItem (không phải item+location riêng) — thô hơn
    // lý tưởng nhưng đơn giản/đúng, đủ cho quy mô Phần 6 MVP.
    await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id = ${parsed.inventoryItemId} FOR UPDATE`;
    const existingMovements = await tx.stockMovement.findMany({
      where: { companyId: company.id, inventoryItemId: parsed.inventoryItemId, locationId: parsed.locationId },
    });
    const currentBalance = calculateStockBalance(toMovementLikes(existingMovements));
    const wouldGoNegative = wouldResultInNegativeBalance(currentBalance, { type: "OUT", quantity: parsed.quantity });

    if (wouldGoNegative) {
      // Chặn âm kho mặc định (ADR-031) — chỉ actor có inventory.manage VÀ có
      // lý do tường minh mới được vượt ngưỡng (vd bán trước, nhập bù sau).
      const canOverride = permissions.has("inventory.manage") && !!parsed.reason && parsed.reason.trim().length > 0;
      if (!canOverride) {
        throw new Error("Số lượng xuất kho vượt quá tồn kho hiện có.");
      }
    }

    const movement = await tx.stockMovement.create({
      data: {
        companyId: company.id,
        inventoryItemId: parsed.inventoryItemId,
        locationId: parsed.locationId,
        type: "OUT",
        quantity: parsed.quantity,
        occurredAt: parsed.occurredAt ?? new Date(),
        sourceType: (parsed.sourceType ?? "MANUAL") as StockMovementSourceType,
        sourceId: parsed.sourceId,
        reason: parsed.reason,
        idempotencyKey: parsed.idempotencyKey,
        actorUserId: actor.id,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.STOCK_ISSUED,
      targetType: "StockMovement",
      targetId: movement.id,
      companyId: company.id,
      metadata: { inventoryItemId: parsed.inventoryItemId, locationId: parsed.locationId, quantity: parsed.quantity },
    });
    return movement;
  });
}

const transferStockSchema = z.object({
  companyId: z.string().min(1),
  inventoryItemId: z.string().min(1),
  fromLocationId: z.string().min(1),
  toLocationId: z.string().min(1),
  quantity: z.number().positive(),
  occurredAt: z.coerce.date().optional(),
  idempotencyKey: z.string().min(1).max(200).optional(),
});

export async function transferStock(actorId: string, input: z.input<typeof transferStockSchema>) {
  const parsed = transferStockSchema.parse(input);
  if (parsed.fromLocationId === parsed.toLocationId) {
    throw new Error("Kho nguồn và kho đích không được trùng nhau.");
  }
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "inventory.transfer");
  await assertSameCompanyInventoryItem(company.id, parsed.inventoryItemId);
  await assertSameCompanyInventoryLocation(company.id, parsed.fromLocationId);
  await assertSameCompanyInventoryLocation(company.id, parsed.toLocationId);

  const correlationId = randomUUID();
  const occurredAt = parsed.occurredAt ?? new Date();
  // @@unique([companyId, idempotencyKey]) không cho 2 dòng trùng key — hậu tố
  // ":out"/":in" để 1 idempotencyKey của actor sinh ra 2 dòng riêng biệt.
  const outIdempotencyKey = parsed.idempotencyKey ? `${parsed.idempotencyKey}:out` : undefined;
  const inIdempotencyKey = parsed.idempotencyKey ? `${parsed.idempotencyKey}:in` : undefined;

  return db.$transaction(async (tx) => {
    // Khoá + tính số dư NGAY TRONG transaction — cùng lý do issueStock: check
    // ngoài transaction không chặn được 2 lần transferStock đồng thời cùng
    // rút cạn 1 kho nguồn (phát hiện qua adversarial review).
    await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id = ${parsed.inventoryItemId} FOR UPDATE`;
    const existingMovements = await tx.stockMovement.findMany({
      where: { companyId: company.id, inventoryItemId: parsed.inventoryItemId, locationId: parsed.fromLocationId },
    });
    const currentBalance = calculateStockBalance(toMovementLikes(existingMovements));
    // Transfer KHÔNG có override âm kho (khác issueStock) — chuyển đi cái
    // không có là bất khả thi vật lý, không phải quyết định nghiệp vụ.
    if (wouldResultInNegativeBalance(currentBalance, { type: "TRANSFER_OUT", quantity: parsed.quantity })) {
      throw new Error("Số lượng chuyển kho vượt quá tồn kho hiện có tại kho nguồn.");
    }

    const outMovement = await tx.stockMovement.create({
      data: {
        companyId: company.id,
        inventoryItemId: parsed.inventoryItemId,
        locationId: parsed.fromLocationId,
        type: "TRANSFER_OUT",
        quantity: parsed.quantity,
        occurredAt,
        sourceType: "TRANSFER",
        sourceId: correlationId,
        idempotencyKey: outIdempotencyKey,
        actorUserId: actor.id,
      },
    });
    const inMovement = await tx.stockMovement.create({
      data: {
        companyId: company.id,
        inventoryItemId: parsed.inventoryItemId,
        locationId: parsed.toLocationId,
        type: "TRANSFER_IN",
        quantity: parsed.quantity,
        occurredAt,
        sourceType: "TRANSFER",
        sourceId: correlationId,
        idempotencyKey: inIdempotencyKey,
        actorUserId: actor.id,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.STOCK_TRANSFERRED,
      targetType: "StockMovement",
      targetId: correlationId,
      companyId: company.id,
      metadata: { fromLocationId: parsed.fromLocationId, toLocationId: parsed.toLocationId, quantity: parsed.quantity },
    });
    return { outMovement, inMovement };
  });
}

// ===== Stock adjustment — two-person approval (ADR-029) =====

const requestStockAdjustmentSchema = z.object({
  companyId: z.string().min(1),
  inventoryItemId: z.string().min(1),
  locationId: z.string().min(1),
  direction: z.enum(["IN", "OUT"]),
  quantity: z.number().positive(),
  reason: z.string().trim().min(1).max(2000),
});

/** Bước 1 — chỉ tạo ApprovalRequest, KHÔNG ghi StockMovement ở đây.
 * StockMovement chỉ sinh ra sau khi request APPROVED, xem
 * executeApprovedStockAdjustment. */
export async function requestStockAdjustment(actorId: string, input: z.input<typeof requestStockAdjustmentSchema>) {
  const parsed = requestStockAdjustmentSchema.parse(input);
  const { company } = await requireCompanyContextForActor(actorId, parsed.companyId, "inventory.adjust");
  await assertSameCompanyInventoryItem(company.id, parsed.inventoryItemId);
  await assertSameCompanyInventoryLocation(company.id, parsed.locationId);

  return createApprovalRequest(actorId, "inventory.adjust", {
    companyId: company.id,
    actionType: "INVENTORY_ADJUSTMENT",
    targetType: "InventoryItem",
    targetId: parsed.inventoryItemId,
    reason: parsed.reason,
    payload: {
      inventoryItemId: parsed.inventoryItemId,
      locationId: parsed.locationId,
      direction: parsed.direction,
      quantity: parsed.quantity,
    },
  });
}

/** Danh sách yêu cầu điều chỉnh tồn kho CẦN HÀNH ĐỘNG — PENDING/PENDING_SECOND
 * (cần duyệt) VÀ APPROVED CHƯA thực thi (cần bấm "Thực thi"). Khác
 * `getPendingApprovalRequests` (approval-service.ts) chỉ trả PENDING/
 * PENDING_SECOND — nếu dùng thẳng hàm đó, request vừa APPROVED xong sẽ biến
 * mất khỏi danh sách trước khi ai kịp bấm Thực thi (bug thật phát hiện lúc
 * viết UI, xem RED_TEAM_CODE_REVIEW_PART6.md). "Đã thực thi" xác định qua
 * StockMovement.idempotencyKey === request.id (executeApprovedStockAdjustment
 * luôn ghi đúng field này). */
export async function getActionableStockAdjustmentRequests(actorId: string, companyId: string) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "inventory.adjust");

  const requests = await db.approvalRequest.findMany({
    where: {
      companyId: company.id,
      actionType: "INVENTORY_ADJUSTMENT",
      status: { in: ["PENDING", "PENDING_SECOND", "APPROVED"] },
    },
    include: {
      requestedBy: { omit: { passwordHash: true } },
      firstApprovedByUser: { omit: { passwordHash: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  if (requests.length === 0) return [];

  // Khớp đúng prefix "approval:" mà executeApprovedStockAdjustment dùng khi
  // ghi StockMovement.idempotencyKey (xem comment tại nơi khai báo).
  const executedMovements = await db.stockMovement.findMany({
    where: { companyId: company.id, idempotencyKey: { in: requests.map((r) => `approval:${r.id}`) } },
    select: { idempotencyKey: true },
  });
  const executedRequestIds = new Set(
    executedMovements.map((m) => m.idempotencyKey?.replace(/^approval:/, "")),
  );

  return requests.filter((r) => !(r.status === "APPROVED" && executedRequestIds.has(r.id)));
}

// Bọc approval-service với permission "inventory.adjust" CỐ ĐỊNH ở tầng
// server — cùng lý do payroll-service.ts (không để client tự chọn
// permission truyền vào firstApproveRequest/secondApproveRequest, tránh
// privilege escalation qua permission bất kỳ actor đang có).

export async function firstApproveStockAdjustment(actorId: string, companyId: string, approvalRequestId: string) {
  return firstApproveRequest(actorId, "inventory.adjust", companyId, approvalRequestId);
}

export async function secondApproveStockAdjustment(actorId: string, companyId: string, approvalRequestId: string) {
  return secondApproveRequest(actorId, "inventory.adjust", companyId, approvalRequestId);
}

export async function rejectStockAdjustment(actorId: string, companyId: string, approvalRequestId: string) {
  return rejectApprovalRequest(actorId, "inventory.adjust", companyId, approvalRequestId);
}

const executeApprovedStockAdjustmentSchema = z.object({
  companyId: z.string().min(1),
  approvalRequestId: z.string().min(1),
});

/** Bước 2 — thực thi sau khi ApprovalRequest đã APPROVED (2 người). Dùng
 * chính request.id làm StockMovement.idempotencyKey — @@unique([companyId,
 * idempotencyKey]) tự chặn gọi lại 2 lần cho cùng 1 approvalRequestId (ném
 * P2002 ở lần thứ 2), không cần tự viết check trạng thái "đã thực thi
 * chưa" riêng. */
export async function executeApprovedStockAdjustment(
  actorId: string,
  input: z.input<typeof executeApprovedStockAdjustmentSchema>,
) {
  const parsed = executeApprovedStockAdjustmentSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "inventory.adjust");

  const request = await db.approvalRequest.findUnique({ where: { id: parsed.approvalRequestId } });
  if (!request || request.companyId !== company.id) {
    throw new AuthorizationError("Yêu cầu phê duyệt không hợp lệ trong công ty này.");
  }
  if (request.actionType !== "INVENTORY_ADJUSTMENT") {
    throw new Error("Yêu cầu này không phải yêu cầu điều chỉnh tồn kho.");
  }
  if (request.status !== "APPROVED") {
    throw new Error("Yêu cầu điều chỉnh tồn kho này chưa được duyệt đủ hai người.");
  }

  // payload đã được ghi tại requestStockAdjustment theo đúng shape này — Json
  // cột không thể zod-validate lại (đã lưu từ trước), chỉ ép kiểu đơn giản.
  const payload = request.payload as {
    inventoryItemId: string;
    locationId: string;
    direction: "IN" | "OUT";
    quantity: number;
  };

  return db.$transaction(async (tx) => {
    const movement = await tx.stockMovement.create({
      data: {
        companyId: company.id,
        inventoryItemId: payload.inventoryItemId,
        locationId: payload.locationId,
        type: payload.direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
        quantity: payload.quantity,
        sourceType: "ADJUSTMENT",
        sourceId: request.id,
        reason: request.reason,
        actorUserId: actor.id,
        // Prefix "approval:" — không dùng thẳng request.id, vì đó là
        // namespace CHUNG với idempotencyKey do actor tự truyền vào
        // receiveStock/issueStock/transferStock (cùng cột
        // @@unique([companyId, idempotencyKey])). Không prefix, một actor
        // chỉ có inventory.receive/issue (không cần inventory.adjust) có
        // thể "chiếm chỗ" idempotencyKey trùng đúng 1 ApprovalRequest.id
        // đang chờ thực thi, khiến executeApprovedStockAdjustment thật sự
        // luôn thất bại vì đụng unique constraint (phát hiện qua
        // adversarial review — vector phá hoại, không phải bypass duyệt).
        idempotencyKey: `approval:${request.id}`,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.STOCK_ADJUSTED,
      targetType: "StockMovement",
      targetId: movement.id,
      companyId: company.id,
      metadata: { approvalRequestId: request.id, direction: payload.direction, quantity: payload.quantity },
    });
    return movement;
  });
}

// ===== Read =====

// Overload để caller không phải tự ép kiểu union — truyền locationId thì
// biết chắc kết quả là number, không truyền thì biết chắc là mảng.
export function getStockBalance(
  actorId: string,
  companyId: string,
  inventoryItemId: string,
  locationId: string,
): Promise<number>;
export function getStockBalance(
  actorId: string,
  companyId: string,
  inventoryItemId: string,
): Promise<{ locationId: string; balance: number }[]>;
export async function getStockBalance(
  actorId: string,
  companyId: string,
  inventoryItemId: string,
  locationId?: string,
) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "inventory.view");
  await assertSameCompanyInventoryItem(company.id, inventoryItemId);
  if (locationId) await assertSameCompanyInventoryLocation(company.id, locationId);

  const movements = await db.stockMovement.findMany({
    where: { companyId: company.id, inventoryItemId, ...(locationId ? { locationId } : {}) },
  });

  if (locationId) {
    return calculateStockBalance(toMovementLikes(movements));
  }

  const byLocation = new Map<string, StockMovementLike[]>();
  for (const movement of movements) {
    const bucket = byLocation.get(movement.locationId) ?? [];
    bucket.push({ type: movement.type, quantity: Number(movement.quantity) });
    byLocation.set(movement.locationId, bucket);
  }
  return Array.from(byLocation.entries()).map(([locId, likes]) => ({
    locationId: locId,
    balance: calculateStockBalance(likes),
  }));
}

export async function getInventoryItemList(actorId: string, companyId: string) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "inventory.view");
  return db.inventoryItem.findMany({ where: { companyId: company.id }, orderBy: { name: "asc" } });
}

export async function getInventoryLocationList(actorId: string, companyId: string) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "inventory.view");
  return db.inventoryLocation.findMany({ where: { companyId: company.id }, orderBy: { name: "asc" } });
}

/** Low Stock signal (mục CXLII/CCXVI) — balance derive qua TOÀN BỘ location
 * của item (không lọc theo 1 location), so với reorderLevel per-item. */
export async function getLowStockItems(
  actorId: string,
  companyId: string,
): Promise<{ item: InventoryItem; currentBalance: number }[]> {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "inventory.view");
  const items = await db.inventoryItem.findMany({
    where: { companyId: company.id, reorderLevel: { not: null }, status: "ACTIVE" },
  });

  const results: { item: InventoryItem; currentBalance: number }[] = [];
  for (const item of items) {
    const movements = await db.stockMovement.findMany({
      where: { companyId: company.id, inventoryItemId: item.id },
    });
    const currentBalance = calculateStockBalance(toMovementLikes(movements));
    if (item.reorderLevel !== null && currentBalance <= Number(item.reorderLevel)) {
      results.push({ item, currentBalance });
    }
  }
  return results;
}

// ===== Phần 7 — điểm nối cho Healthcare (ADR-043) =====

export type IssueStockTxParams = {
  companyId: string;
  inventoryItemId: string;
  locationId: string;
  quantity: number;
  occurredAt?: Date;
  reason?: string;
  sourceType: StockMovementSourceType;
  sourceId: string;
  /** Do SERVER sinh, không nhận từ client (bài học ADR-034). */
  idempotencyKey: string;
  actorUserId: string;
  allowNegative?: boolean;
};

/**
 * Trừ kho trong CÙNG tx được truyền vào, KHÔNG tự kiểm permission.
 *
 * Vì sao cần bản riêng thay vì gọi `issueStock`: `issueStock` gác bằng
 * `inventory.issue`, nhưng người hoàn tất thủ thuật là bác sĩ — pack
 * HEALTHCARE_DOCTOR cố ý KHÔNG có `inventory.issue` (cho quyền đó nghĩa là
 * bác sĩ xuất được kho tuỳ ý, quá rộng). Caller (procedure-service) đã tự
 * kiểm `healthcare.procedure.perform` rồi, nên ở đây chỉ còn phần ghi.
 * Cùng pattern với `createExpenseRecordTx` của Phần 6 (payroll-service ghi
 * Expense mà không cần `finance.expense.create`).
 *
 * GỌI TỪ ĐÂU: chỉ domain service đã tự kiểm quyền của chính nó. KHÔNG export
 * ra Server Action.
 *
 * Idempotent theo `idempotencyKey`: gọi lại lần 2 trả về movement cũ,
 * KHÔNG trừ kho lần nữa và KHÔNG báo lỗi (bất biến #39 — spec đánh dấu
 * "Critical"; retry mạng là kịch bản bình thường, không phải lỗi người dùng).
 */
export async function issueStockTx(tx: Prisma.TransactionClient, params: IssueStockTxParams) {
  const existing = await tx.stockMovement.findFirst({
    where: { companyId: params.companyId, idempotencyKey: params.idempotencyKey },
  });
  if (existing) return existing;

  // Khoá row rồi tính số dư NGAY TRONG tx — cùng lý do đã ghi ở issueStock:
  // hai lần trừ kho đồng thời cùng đọc một baseline sẽ cùng pass check.
  await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id = ${params.inventoryItemId} FOR UPDATE`;

  const movements = await tx.stockMovement.findMany({
    where: {
      companyId: params.companyId,
      inventoryItemId: params.inventoryItemId,
      locationId: params.locationId,
    },
    select: { type: true, quantity: true },
  });
  const balance = calculateStockBalance(toMovementLikes(movements));
  if (
    !params.allowNegative &&
    wouldResultInNegativeBalance(balance, { type: "OUT", quantity: params.quantity })
  ) {
    throw new Error(
      `Không đủ tồn kho: còn ${balance}, cần ${params.quantity}. Không tự động cho âm kho.`,
    );
  }

  const movement = await tx.stockMovement.create({
    data: {
      companyId: params.companyId,
      inventoryItemId: params.inventoryItemId,
      locationId: params.locationId,
      type: "OUT",
      quantity: params.quantity,
      occurredAt: params.occurredAt,
      reason: params.reason,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      idempotencyKey: params.idempotencyKey,
      actorUserId: params.actorUserId,
    },
  });

  await recordAudit(tx, {
    actorUserId: params.actorUserId,
    action: AUDIT_ACTIONS.STOCK_ISSUED,
    targetType: "StockMovement",
    targetId: movement.id,
    companyId: params.companyId,
    metadata: { sourceType: params.sourceType, sourceId: params.sourceId },
  });

  return movement;
}

/** Hoàn kho cho một lần trừ đã ghi (reversal, không xoá cứng — bất biến #44/#96). */
export async function reverseStockIssueTx(
  tx: Prisma.TransactionClient,
  params: Omit<IssueStockTxParams, "allowNegative"> & { reason: string },
) {
  const existing = await tx.stockMovement.findFirst({
    where: { companyId: params.companyId, idempotencyKey: params.idempotencyKey },
  });
  if (existing) return existing;

  const movement = await tx.stockMovement.create({
    data: {
      companyId: params.companyId,
      inventoryItemId: params.inventoryItemId,
      locationId: params.locationId,
      type: "IN",
      quantity: params.quantity,
      occurredAt: params.occurredAt,
      reason: params.reason,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      idempotencyKey: params.idempotencyKey,
      actorUserId: params.actorUserId,
    },
  });

  await recordAudit(tx, {
    actorUserId: params.actorUserId,
    action: AUDIT_ACTIONS.STOCK_RECEIVED,
    targetType: "StockMovement",
    targetId: movement.id,
    companyId: params.companyId,
    metadata: { reversalOf: params.sourceId, reason: params.reason },
  });

  return movement;
}
