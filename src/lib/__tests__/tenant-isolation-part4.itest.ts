// Integration test suite — Tenant Isolation Matrix cho Phần 4 (Organization
// + Work Core + Project). Master Prompt mục CV-CCXIII. Chạy trên Postgres
// thật (docker compose up -d). Cùng nguyên tắc với tenant-isolation.itest.ts:
// test qua đúng entry point domain service thật, không test resolver cô lập.

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { AuthorizationError } from "@/lib/authorization/errors";
import * as organizationService from "@/lib/domain/organization-service";
import * as workService from "@/lib/domain/work-service";
import * as projectService from "@/lib/domain/project-service";

const DATABASE_URL = process.env.DATABASE_URL ?? "";
if (/clinic|production|hongphuc|zenith/i.test(DATABASE_URL)) {
  throw new Error(
    `Refusing to run tenant-isolation-part4.itest.ts against a DB URL that looks like production/clinic: ${DATABASE_URL}`,
  );
}

type Fixtures = Awaited<ReturnType<typeof seed>>;
let fx: Fixtures;

async function seed() {
  const suffix = Math.random().toString(36).slice(2, 8);
  const pw = await hashPassword("Test-Password-123");

  const mkUser = (name: string) =>
    db.user.create({
      data: { displayName: name, email: `${name.toLowerCase()}-${suffix}@test.local`, passwordHash: pw },
    });

  const [ownerA, managerA, memberA, viewerA, ownerB, memberB, outsider] = await Promise.all([
    mkUser("OwnerA4"),
    mkUser("ManagerA4"),
    mkUser("MemberA4"),
    mkUser("ViewerA4"),
    mkUser("OwnerB4"),
    mkUser("MemberB4"),
    mkUser("Outsider4"),
  ]);

  const ecosystem = await db.ecosystem.create({ data: { code: `e4-${suffix}`, name: "E4" } });

  const companyA = await db.company.create({
    data: { ecosystemId: ecosystem.id, code: `p4-company-a-${suffix}`, name: "Company A4", status: "ACTIVE" },
  });
  const companyB = await db.company.create({
    data: { ecosystemId: ecosystem.id, code: `p4-company-b-${suffix}`, name: "Company B4", status: "ACTIVE" },
  });

  await db.companyMembership.createMany({
    data: [
      { companyId: companyA.id, userId: ownerA.id, rolePreset: "OWNER" },
      { companyId: companyA.id, userId: managerA.id, rolePreset: "MANAGER" },
      { companyId: companyA.id, userId: memberA.id, rolePreset: "MEMBER" },
      { companyId: companyA.id, userId: viewerA.id, rolePreset: "VIEWER" },
      { companyId: companyB.id, userId: ownerB.id, rolePreset: "OWNER" },
      { companyId: companyB.id, userId: memberB.id, rolePreset: "MEMBER" },
    ],
  });

  const unitA = await db.organizationUnit.create({
    data: { companyId: companyA.id, type: "DEPARTMENT", name: "Phòng A" },
  });
  const positionA = await db.position.create({ data: { companyId: companyA.id, name: "Nhân viên A" } });
  const unitB = await db.organizationUnit.create({
    data: { companyId: companyB.id, type: "DEPARTMENT", name: "Phòng B" },
  });
  const positionB = await db.position.create({ data: { companyId: companyB.id, name: "Nhân viên B" } });

  return {
    suffix,
    ownerA,
    managerA,
    memberA,
    viewerA,
    ownerB,
    memberB,
    outsider,
    ecosystem,
    companyA,
    companyB,
    unitA,
    positionA,
    unitB,
    positionB,
  };
}

async function cleanup(f: Fixtures) {
  const userIds = [f.ownerA, f.managerA, f.memberA, f.viewerA, f.ownerB, f.memberB, f.outsider].map((u) => u.id);
  const companyIds = [f.companyA.id, f.companyB.id];
  await db.auditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
  await db.projectMembership.deleteMany({ where: { project: { companyId: { in: companyIds } } } });
  await db.workItem.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.project.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.assignment.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.position.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.organizationUnit.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.companyMembership.deleteMany({ where: { userId: { in: userIds } } });
  await db.company.deleteMany({ where: { id: { in: companyIds } } });
  await db.ecosystem.deleteMany({ where: { id: f.ecosystem.id } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
}

beforeAll(async () => {
  fx = await seed();
});

afterAll(async () => {
  await cleanup(fx);
});

describe("Organization — quyền tạo cấu trúc (mục V-XI)", () => {
  it("OwnerA tạo OrganizationUnit trong Company A: allowed", async () => {
    const unit = await organizationService.createOrganizationUnit(fx.ownerA.id, {
      companyId: fx.companyA.id,
      type: "TEAM",
      name: "Nhóm test",
    });
    expect(unit.companyId).toBe(fx.companyA.id);
  });

  it("MemberA (không có organization.manage) tạo OrganizationUnit: DENY", async () => {
    await expect(
      organizationService.createOrganizationUnit(fx.memberA.id, { companyId: fx.companyA.id, type: "TEAM", name: "X" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("OwnerA tạo unit với parentId thuộc Company B (cross-company FK injection): DENY", async () => {
    await expect(
      organizationService.createOrganizationUnit(fx.ownerA.id, {
        companyId: fx.companyA.id,
        parentId: fx.unitB.id,
        type: "TEAM",
        name: "X",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("Không lưu trữ được Position khi còn Assignment đang hoạt động", async () => {
    const assignment = await organizationService.createAssignment(fx.ownerA.id, {
      companyId: fx.companyA.id,
      userId: fx.memberA.id,
      positionId: fx.positionA.id,
    });
    await expect(organizationService.archivePosition(fx.ownerA.id, fx.companyA.id, fx.positionA.id)).rejects.toThrow(
      /còn người đang giữ/,
    );
    await organizationService.endAssignment(fx.ownerA.id, fx.companyA.id, assignment.id);
  });
});

describe("Organization — Assignment cross-company + non-member (mục XVIII)", () => {
  it("Gán Position của Company B cho user Company A: DENY", async () => {
    await expect(
      organizationService.createAssignment(fx.ownerA.id, {
        companyId: fx.companyA.id,
        userId: fx.memberA.id,
        positionId: fx.positionB.id,
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("Gán vị trí Company A cho user không phải thành viên Company A (Outsider): DENY", async () => {
    await expect(
      organizationService.createAssignment(fx.ownerA.id, {
        companyId: fx.companyA.id,
        userId: fx.outsider.id,
        positionId: fx.positionA.id,
      }),
    ).rejects.toThrow(/thành viên đang hoạt động/);
  });

  it("Gán vị trí Company A cho user chỉ thuộc Company B (memberB): DENY", async () => {
    await expect(
      organizationService.createAssignment(fx.ownerA.id, {
        companyId: fx.companyA.id,
        userId: fx.memberB.id,
        positionId: fx.positionA.id,
      }),
    ).rejects.toThrow(/thành viên đang hoạt động/);
  });

  it("ManagerA (có people.assign) gán vị trí hợp lệ trong Company A: allowed", async () => {
    const assignment = await organizationService.createAssignment(fx.managerA.id, {
      companyId: fx.companyA.id,
      userId: fx.memberA.id,
      positionId: fx.positionA.id,
      organizationUnitId: fx.unitA.id,
    });
    expect(assignment.userId).toBe(fx.memberA.id);
    await organizationService.endAssignment(fx.managerA.id, fx.companyA.id, assignment.id);
  });
});

describe("Work — self-serve vs work.assign (mục XXVI-XXXIV)", () => {
  it("MemberA tạo WorkItem giao cho chính mình (không cần work.assign): allowed", async () => {
    const item = await workService.createWorkItem(fx.memberA.id, {
      companyId: fx.companyA.id,
      title: "Việc của tôi",
      assigneeUserId: fx.memberA.id,
    });
    expect(item.assigneeUserId).toBe(fx.memberA.id);
  });

  it("MemberA tạo WorkItem giao cho người khác (không có work.assign): DENY", async () => {
    await expect(
      workService.createWorkItem(fx.memberA.id, {
        companyId: fx.companyA.id,
        title: "Giao cho người khác",
        assigneeUserId: fx.viewerA.id,
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("ViewerA (không có work.create) tạo WorkItem: DENY", async () => {
    await expect(
      workService.createWorkItem(fx.viewerA.id, { companyId: fx.companyA.id, title: "X" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("ManagerA giao WorkItem cho người thuộc Company B (cross-company assignee): DENY", async () => {
    await expect(
      workService.createWorkItem(fx.managerA.id, {
        companyId: fx.companyA.id,
        title: "Cross company assignee",
        assigneeUserId: fx.memberB.id,
      }),
    ).rejects.toThrow(/thành viên đang hoạt động/);
  });

  it("Tạo WorkItem với organizationUnitId thuộc Company B: DENY", async () => {
    await expect(
      workService.createWorkItem(fx.managerA.id, {
        companyId: fx.companyA.id,
        title: "Cross company unit",
        organizationUnitId: fx.unitB.id,
      }),
    ).rejects.toThrow(AuthorizationError);
  });
});

describe("Work — quyền hành động trên 1 WorkItem cụ thể (mục XXXVI-XLI)", () => {
  it("ViewerA (không phải assignee/creator, không có work.manage) cố hoàn thành việc của MemberA: DENY", async () => {
    const item = await workService.createWorkItem(fx.memberA.id, {
      companyId: fx.companyA.id,
      title: "Việc riêng của MemberA",
      assigneeUserId: fx.memberA.id,
    });
    await expect(workService.completeWorkItem(fx.viewerA.id, fx.companyA.id, item.id)).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("MemberA tự bắt đầu và hoàn thành việc của chính mình: allowed", async () => {
    const item = await workService.createWorkItem(fx.memberA.id, {
      companyId: fx.companyA.id,
      title: "Việc tự làm",
      assigneeUserId: fx.memberA.id,
    });
    const started = await workService.startWorkItem(fx.memberA.id, fx.companyA.id, item.id);
    expect(started.status).toBe("IN_PROGRESS");
    const completed = await workService.completeWorkItem(fx.memberA.id, fx.companyA.id, item.id);
    expect(completed.status).toBe("DONE");
  });

  it("OwnerA (có work.manage) hoàn thành việc của người khác: allowed", async () => {
    const item = await workService.createWorkItem(fx.memberA.id, {
      companyId: fx.companyA.id,
      title: "Việc MemberA, Owner can quản lý",
      assigneeUserId: fx.memberA.id,
    });
    const completed = await workService.completeWorkItem(fx.ownerA.id, fx.companyA.id, item.id);
    expect(completed.status).toBe("DONE");
  });

  it("MemberB thao tác trực tiếp lên WorkItem của Company A bằng ID biết trước: DENY", async () => {
    const item = await workService.createWorkItem(fx.memberA.id, {
      companyId: fx.companyA.id,
      title: "Việc Company A",
      assigneeUserId: fx.memberA.id,
    });
    await expect(workService.completeWorkItem(fx.memberB.id, fx.companyB.id, item.id)).rejects.toThrow(
      AuthorizationError,
    );
  });
});

describe("Work — ADR-015 visibility (SELF vs COMPANY)", () => {
  it("MemberA chỉ thấy việc của chính mình (không thấy việc người khác) trong getCompanyWork", async () => {
    const other = await workService.createWorkItem(fx.ownerA.id, {
      companyId: fx.companyA.id,
      title: "Việc của Owner",
      assigneeUserId: fx.ownerA.id,
    });
    const mine = await workService.createWorkItem(fx.memberA.id, {
      companyId: fx.companyA.id,
      title: "Việc của Member",
      assigneeUserId: fx.memberA.id,
    });
    const list = await workService.getCompanyWork(fx.memberA.id, fx.companyA.id);
    const ids = list.map((i) => i.id);
    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(other.id);
  });

  it("ManagerA (có work.assign) thấy toàn bộ việc của Company A", async () => {
    const list = await workService.getCompanyWork(fx.managerA.id, fx.companyA.id);
    const companyIds = new Set(list.map((i) => i.companyId));
    expect(companyIds.size).toBeLessThanOrEqual(1);
    expect(list.length).toBeGreaterThan(0);
  });
});

describe("Project — tạo + cross-company member (mục LXIII, CVII)", () => {
  it("ManagerA tạo Project: allowed, tự động thành ProjectMembership OWNER", async () => {
    const project = await projectService.createProject(fx.managerA.id, {
      companyId: fx.companyA.id,
      code: `proj-${fx.suffix}`,
      name: "Dự án A",
    });
    expect(project.ownerUserId).toBe(fx.managerA.id);
    const membership = await db.projectMembership.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: fx.managerA.id } },
    });
    expect(membership?.rolePreset).toBe("OWNER");
  });

  it("MemberA (không có project.create) tạo Project: DENY", async () => {
    await expect(
      projectService.createProject(fx.memberA.id, { companyId: fx.companyA.id, code: `x-${fx.suffix}`, name: "X" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("Trùng mã Project trong cùng Company: DENY", async () => {
    const code = `dup-${fx.suffix}`;
    await projectService.createProject(fx.ownerA.id, { companyId: fx.companyA.id, code, name: "Bản gốc" });
    await expect(
      projectService.createProject(fx.ownerA.id, { companyId: fx.companyA.id, code, name: "Bản trùng" }),
    ).rejects.toThrow(/đã tồn tại/);
  });

  it("Thêm thành viên Company B vào Project của Company A: DENY", async () => {
    const project = await projectService.createProject(fx.ownerA.id, {
      companyId: fx.companyA.id,
      code: `cross-member-${fx.suffix}`,
      name: "Dự án cross member",
    });
    await expect(
      projectService.addProjectMember(fx.ownerA.id, {
        companyId: fx.companyA.id,
        projectId: project.id,
        userId: fx.memberB.id,
      }),
    ).rejects.toThrow(/thành viên đang hoạt động/);
  });

  it("MemberA (không project.manage, không phải Project OWNER) cố thêm thành viên: DENY", async () => {
    const project = await projectService.createProject(fx.ownerA.id, {
      companyId: fx.companyA.id,
      code: `no-manage-${fx.suffix}`,
      name: "Dự án không quản lý",
    });
    await expect(
      projectService.addProjectMember(fx.memberA.id, {
        companyId: fx.companyA.id,
        projectId: project.id,
        userId: fx.viewerA.id,
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("ManagerA (Project OWNER-membership nhưng không có project.manage cấp Company) vẫn thêm được thành viên project của mình", async () => {
    const project = await projectService.createProject(fx.managerA.id, {
      companyId: fx.companyA.id,
      code: `owner-membership-${fx.suffix}`,
      name: "Dự án ManagerA sở hữu",
    });
    const membership = await projectService.addProjectMember(fx.managerA.id, {
      companyId: fx.companyA.id,
      projectId: project.id,
      userId: fx.memberA.id,
    });
    expect(membership.userId).toBe(fx.memberA.id);
  });

  it("ManagerA (Project OWNER-membership) KHÔNG archive được project — project.archive chỉ OWNER/COMPANY_ADMIN cấp Company", async () => {
    const project = await projectService.createProject(fx.managerA.id, {
      companyId: fx.companyA.id,
      code: `archive-deny-${fx.suffix}`,
      name: "Dự án không được archive",
    });
    await expect(projectService.archiveProject(fx.managerA.id, fx.companyA.id, project.id)).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("OwnerA (company.OWNER, có project.archive) archive được project của người khác: allowed", async () => {
    const project = await projectService.createProject(fx.managerA.id, {
      companyId: fx.companyA.id,
      code: `archive-allow-${fx.suffix}`,
      name: "Dự án được archive",
    });
    const archived = await projectService.archiveProject(fx.ownerA.id, fx.companyA.id, project.id);
    expect(archived.status).toBe("ARCHIVED");
  });
});

describe("Suspended Company chặn ghi Phần 4 (mục LXXVI áp dụng cho Organization/Work/Project)", () => {
  it("Company A suspended → createOrganizationUnit/createWorkItem/createProject đều DENY, đọc vẫn được", async () => {
    await db.company.update({ where: { id: fx.companyA.id }, data: { status: "SUSPENDED" } });
    try {
      await expect(
        organizationService.createOrganizationUnit(fx.ownerA.id, { companyId: fx.companyA.id, type: "TEAM", name: "X" }),
      ).rejects.toThrow(AuthorizationError);
      await expect(
        workService.createWorkItem(fx.ownerA.id, { companyId: fx.companyA.id, title: "X", assigneeUserId: fx.ownerA.id }),
      ).rejects.toThrow(AuthorizationError);
      await expect(
        projectService.createProject(fx.ownerA.id, { companyId: fx.companyA.id, code: `susp-${fx.suffix}`, name: "X" }),
      ).rejects.toThrow(AuthorizationError);

      const units = await organizationService.getOrganizationTree(fx.ownerA.id, fx.companyA.id);
      expect(Array.isArray(units)).toBe(true);
    } finally {
      await db.company.update({ where: { id: fx.companyA.id }, data: { status: "ACTIVE" } });
    }
  });

  it("Company A suspended → updateProject/addProjectMember/completeProject trên project có sẵn cũng DENY (red-team review Phần 4: các hàm này gate bằng project.view nên phải tự chặn Suspended riêng, không dựa isWriteAction)", async () => {
    const project = await projectService.createProject(fx.ownerA.id, {
      companyId: fx.companyA.id,
      code: `susp-project-${fx.suffix}`,
      name: "Dự án trước khi suspend",
    });
    await db.company.update({ where: { id: fx.companyA.id }, data: { status: "SUSPENDED" } });
    try {
      await expect(
        projectService.updateProject(fx.ownerA.id, { companyId: fx.companyA.id, projectId: project.id, name: "X" }),
      ).rejects.toThrow(AuthorizationError);
      await expect(
        projectService.addProjectMember(fx.ownerA.id, {
          companyId: fx.companyA.id,
          projectId: project.id,
          userId: fx.memberA.id,
        }),
      ).rejects.toThrow(AuthorizationError);
      await expect(
        projectService.completeProject(fx.ownerA.id, fx.companyA.id, project.id),
      ).rejects.toThrow(AuthorizationError);
    } finally {
      await db.company.update({ where: { id: fx.companyA.id }, data: { status: "ACTIVE" } });
    }
  });
});
