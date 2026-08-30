import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { resolveCompanyPermissions, resolveEcosystemPermissions } from "@/lib/permissions/resolver";
import { AuthorizationError } from "@/lib/authorization/errors";
import type { CompanyPermission } from "@/lib/permissions/registry";
import type { Company, CompanyMembership, Ecosystem, User } from "@/generated/prisma";

export type AuthorizedCompanyContext = {
  actor: User;
  ecosystem: Ecosystem;
  company: Company;
  /** null khi actor truy cập qua ecosystem.company.view_all (aggregate, chỉ đọc) thay vì CompanyMembership thật. */
  membership: CompanyMembership | null;
  permissions: Set<CompanyPermission>;
};

// ===== Core (testable, KHÔNG đụng cookies()/next/headers) =====
// Master Prompt mục XXXVIII/LVI/LXXXVI — cốt lõi toàn bộ tenant isolation.
// MỌI domain service ở Phần 4 trở đi phải gọi qua đây để lấy companyId đã
// xác thực. Nhận actorId tường minh — không tự đọc session — để test
// integration gọi trực tiếp với actor giả lập, không cần giả lập HTTP
// request/cookie.
export async function resolveCompanyContextForActor(
  actorId: string,
  companyId: string,
): Promise<AuthorizedCompanyContext | null> {
  const actor = await db.user.findUnique({ where: { id: actorId } });
  if (!actor || actor.status !== "ACTIVE") return null;

  const company = await db.company.findUnique({
    where: { id: companyId },
    include: { ecosystem: true },
  });
  if (!company) return null;

  // Đường 1: CompanyMembership thật trên đúng Company này.
  const companyPermissions = await resolveCompanyPermissions(actor.id, company.id);
  if (companyPermissions.size > 0) {
    const membership = await db.companyMembership.findUnique({
      where: { companyId_userId: { companyId: company.id, userId: actor.id } },
    });
    return { actor, ecosystem: company.ecosystem, company, membership, permissions: companyPermissions };
  }

  // Đường 2: KHÔNG có CompanyMembership — chỉ còn "ecosystem.company.view_all"
  // (đọc aggregate của Founder/Ecosystem Admin/Auditor). Đây KHÔNG cấp quyền
  // ghi — theo đúng sửa đổi sau red-team review Phần 2: role Ecosystem-tier
  // không tự động ghi vào một Company cụ thể nếu thiếu CompanyMembership
  // tường minh. Chỉ trả về "company.view", không trả company.manage/
  // members.*.
  const ecosystemPermissions = await resolveEcosystemPermissions(actor.id, company.ecosystemId);
  if (ecosystemPermissions.has("ecosystem.company.view_all")) {
    return {
      actor,
      ecosystem: company.ecosystem,
      company,
      membership: null,
      permissions: new Set<CompanyPermission>(["company.view"]),
    };
  }

  return null; // DEFAULT DENY — mục LXXXIII
}

export async function resolveCompanyContextByCodeForActor(
  actorId: string,
  code: string,
): Promise<AuthorizedCompanyContext | null> {
  // Company.code chỉ unique trong 1 Ecosystem (ADR-012). Deployment hiện tại
  // chỉ có 1 Ecosystem nên đủ; nếu về sau có nhiều Ecosystem và trùng code,
  // đây là giới hạn đã biết (mục CXXIV Master Prompt cho phép defer UX đa
  // Ecosystem) — resolve theo company CŨ NHẤT (orderBy createdAt) mà actor
  // có quyền xem, để routing xác định (deterministic), không tuỳ ý theo thứ
  // tự trả về của DB. KHÔNG phải rủi ro tenant-isolation (mỗi candidate vẫn
  // tự re-authorize độc lập) — chỉ là UX nhất quán, sửa sau red-team review.
  const candidates = await db.company.findMany({ where: { code }, orderBy: { createdAt: "asc" } });
  for (const candidate of candidates) {
    const ctx = await resolveCompanyContextForActor(actorId, candidate.id);
    if (ctx) return ctx;
  }
  return null;
}

export async function requireCompanyContextForActor(
  actorId: string,
  companyId: string,
  permission: CompanyPermission,
): Promise<AuthorizedCompanyContext> {
  const ctx = await resolveCompanyContextForActor(actorId, companyId);
  if (!ctx || !ctx.permissions.has(permission)) throw new AuthorizationError();
  if (ctx.company.status !== "ACTIVE" && isWriteAction(permission)) {
    throw new AuthorizationError("Công ty đang tạm dừng hoặc lưu trữ — không thể ghi dữ liệu mới.");
  }
  return ctx;
}

function isWriteAction(permission: CompanyPermission): boolean {
  return permission !== "company.view" && permission !== "company.members.view";
}

/** Danh sách Company mà actor có thể thấy — server-filtered (mục LXII/CXXVIII), không fetch-all-rồi-lọc-client. */
export async function getAccessibleCompanies(actorId: string, ecosystemId: string): Promise<Company[]> {
  const ecosystemPermissions = await resolveEcosystemPermissions(actorId, ecosystemId);
  if (ecosystemPermissions.has("ecosystem.company.view_all")) {
    return db.company.findMany({ where: { ecosystemId }, orderBy: { createdAt: "asc" } });
  }
  const memberships = await db.companyMembership.findMany({
    where: { userId: actorId, status: "ACTIVE", company: { ecosystemId } },
    include: { company: true },
  });
  return memberships.map((m) => m.company);
}

// ===== Request-scoped wrappers (dùng cookies(), chỉ gọi trong Server Component/Action) =====

/** Dùng trong Server Component / page loader — 404 nếu không có quyền (chống resource enumeration, mục CXII). */
export async function requireCompanyPage(
  companyId: string,
  permission: CompanyPermission,
): Promise<AuthorizedCompanyContext> {
  const actor = await getCurrentActor();
  if (!actor) notFound();
  const ctx = await resolveCompanyContextForActor(actor.id, companyId);
  if (!ctx || !ctx.permissions.has(permission)) notFound();
  return ctx;
}

export async function requireCompanyPageByCode(
  code: string,
  permission: CompanyPermission,
): Promise<AuthorizedCompanyContext> {
  const actor = await getCurrentActor();
  if (!actor) notFound();
  const ctx = await resolveCompanyContextByCodeForActor(actor.id, code);
  if (!ctx || !ctx.permissions.has(permission)) notFound();
  return ctx;
}

/** Dùng trong Server Action — throw lỗi chung thay vì notFound(). */
export async function requireCompanyAction(
  companyId: string,
  permission: CompanyPermission,
): Promise<AuthorizedCompanyContext> {
  const actor = await getCurrentActor();
  if (!actor) throw new AuthorizationError();
  return requireCompanyContextForActor(actor.id, companyId, permission);
}
