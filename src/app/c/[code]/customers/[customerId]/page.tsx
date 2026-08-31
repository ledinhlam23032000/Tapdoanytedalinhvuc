import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { AuthorizationError } from "@/lib/authorization/errors";
import { getCustomerDetail, getCustomerTimeline } from "@/lib/domain/customer-service";
import { getOpenWorkForCustomer } from "@/lib/domain/work-service";
import { getOrganizationTree } from "@/lib/domain/organization-service";
import { db } from "@/lib/db";
import {
  CUSTOMER_STATUS_LABEL,
  CUSTOMER_JOURNEY_STAGE_LABEL,
  CUSTOMER_INTERACTION_TYPE_LABEL,
  APPOINTMENT_STATUS_LABEL,
  SALE_STATUS_LABEL,
  formatDateTime,
  formatDueDate,
  formatMoney,
} from "../../work-labels";
import { AssignOwnerForm } from "./assign-owner-form";
import { EditCustomerForm } from "./edit-customer-form";
import { ArchiveCustomerButton } from "./archive-customer-button";
import { AddInteractionForm } from "./add-interaction-form";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ code: string; customerId: string }>;
}) {
  const { code, customerId } = await params;
  const ctx = await requireCompanyPageByCode(code, "customer.view");
  const canViewWork = ctx.permissions.has("work.view");

  let result: [
    Awaited<ReturnType<typeof getCustomerDetail>>,
    Awaited<ReturnType<typeof getCustomerTimeline>>,
    Awaited<ReturnType<typeof getOpenWorkForCustomer>>,
  ];
  try {
    result = await Promise.all([
      getCustomerDetail(ctx.actor.id, ctx.company.id, customerId),
      getCustomerTimeline(ctx.actor.id, ctx.company.id, customerId),
      canViewWork ? getOpenWorkForCustomer(ctx.actor.id, ctx.company.id, customerId) : Promise.resolve([]),
    ]);
  } catch (err) {
    // AuthorizationError (không tồn tại/khác Company) là ca bình thường —
    // 404 im lặng đúng chủ đích (chống resource enumeration, mục CXII).
    // Bất kỳ lỗi nào khác (vd decryptPhone thất bại do ciphertext hỏng) là
    // sự cố toàn vẹn dữ liệu thật — vẫn 404 cho user nhưng phải log lại,
    // không được nuốt hoàn toàn im lặng (red-team review Phần 5).
    if (!(err instanceof AuthorizationError)) console.error("customers/[customerId] lỗi không mong đợi:", err);
    notFound();
  }
  const [customer, timeline, openWork] = result;

  const canAssign = ctx.permissions.has("customer.assign");
  const canUpdate = ctx.permissions.has("customer.update");
  const canArchive = ctx.permissions.has("customer.archive");
  const canInteract = ctx.permissions.has("customer.interaction.create");
  const canCreateAppointment = ctx.permissions.has("appointment.create");
  const canCreateSale = ctx.permissions.has("sales.create");

  const [companyMembers, sources, organizationUnits] = await Promise.all([
    canAssign
      ? db.companyMembership.findMany({
          where: { companyId: ctx.company.id, status: "ACTIVE" },
          include: { user: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    canUpdate
      ? db.customerSource.findMany({ where: { companyId: ctx.company.id }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    canUpdate ? getOrganizationTree(ctx.actor.id, ctx.company.id) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">{customer.name}</h2>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
              {CUSTOMER_STATUS_LABEL[customer.status] ?? customer.status}
            </span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
              {CUSTOMER_JOURNEY_STAGE_LABEL[customer.journeyStage] ?? customer.journeyStage}
            </span>
          </div>
          {customer.code ? <p className="text-sm text-zinc-500">{customer.code}</p> : null}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
            <span>Người phụ trách: {customer.owner?.displayName ?? "—"}</span>
            <span>Nguồn: {customer.source?.name ?? "—"}</span>
            <span>Điện thoại: {customer.phone ?? "—"}</span>
            <span>Email: {customer.email ?? "—"}</span>
          </div>
        </div>
        {canArchive ? (
          <ArchiveCustomerButton companyId={ctx.company.id} customerId={customer.id} status={customer.status} />
        ) : null}
      </div>

      <div className="flex flex-wrap gap-4">
        {canCreateAppointment ? (
          <Link
            href={`/c/${code}/appointments?customerId=${customer.id}`}
            className="text-sm text-zinc-900 hover:underline"
          >
            Tạo lịch hẹn
          </Link>
        ) : null}
        {canCreateSale ? (
          <Link
            href={`/c/${code}/sales?customerId=${customer.id}`}
            className="text-sm text-zinc-900 hover:underline"
          >
            Tạo giao dịch
          </Link>
        ) : null}
      </div>

      {canAssign ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-zinc-900">Đổi người phụ trách</h3>
          <AssignOwnerForm
            companyId={ctx.company.id}
            customerId={customer.id}
            currentOwnerUserId={customer.ownerUserId}
            members={companyMembers.map((m) => ({ id: m.userId, displayName: m.user.displayName }))}
          />
        </section>
      ) : null}

      {canUpdate ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-zinc-900">Sửa thông tin khách hàng</h3>
          <EditCustomerForm
            companyId={ctx.company.id}
            customerId={customer.id}
            initial={{
              name: customer.name,
              phone: customer.phone ?? "",
              email: customer.email ?? "",
              address: customer.address ?? "",
              sourceId: customer.sourceId ?? "",
              organizationUnitId: customer.organizationUnitId ?? "",
            }}
            sources={sources.map((s) => ({ id: s.id, name: s.name }))}
            organizationUnits={organizationUnits.map((u) => ({ id: u.id, name: u.name }))}
          />
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">Ghi chú & tương tác</h3>
        {canInteract ? <AddInteractionForm companyId={ctx.company.id} customerId={customer.id} /> : null}
        {timeline.interactions.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
            Chưa có tương tác nào.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {timeline.interactions.map((i) => (
              <li key={i.id} className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">
                    {CUSTOMER_INTERACTION_TYPE_LABEL[i.type] ?? i.type}
                  </span>
                  <span>{formatDateTime(i.occurredAt.toISOString())}</span>
                  <span>{i.performedBy.displayName}</span>
                </div>
                <p className="mt-1 text-zinc-900">{i.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">Lịch hẹn</h3>
        {timeline.appointments.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
            Chưa có lịch hẹn nào.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {timeline.appointments.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/c/${code}/appointments/${a.id}`}
                  className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-4 py-3 hover:border-zinc-400"
                >
                  <span className="text-zinc-900">{a.title}</span>
                  <span className="flex items-center gap-3 text-xs text-zinc-500">
                    <span>{formatDateTime(a.startAt.toISOString())}</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">
                      {APPOINTMENT_STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">Giao dịch</h3>
        {timeline.sales.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
            Chưa có giao dịch nào.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {timeline.sales.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/c/${code}/sales/${s.id}`}
                  className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-4 py-3 hover:border-zinc-400"
                >
                  <span className="text-zinc-900">{s.code ?? s.id}</span>
                  <span className="flex items-center gap-3 text-xs text-zinc-500">
                    <span>{formatDueDate(s.createdAt.toISOString())}</span>
                    <span>{formatMoney(s.totalAmount.toString())}</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">
                      {SALE_STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canViewWork ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-zinc-900">Việc đang mở</h3>
          {openWork.length === 0 ? (
            <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
              Không có việc nào đang mở.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {openWork.map((w) => (
                <li key={w.id} className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm">
                  <span className="text-zinc-900">{w.title}</span>
                  <span className="ml-2 text-xs text-zinc-500">{w.assignee?.displayName ?? "Chưa giao"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
