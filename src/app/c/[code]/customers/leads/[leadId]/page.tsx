import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { AuthorizationError } from "@/lib/authorization/errors";
import { getLeadDetail } from "@/lib/domain/lead-service";
import { db } from "@/lib/db";
import { LEAD_STATUS_LABEL } from "../../../work-labels";
import { ConvertLeadButton } from "./convert-lead-button";
import { LeadOwnerForm } from "./lead-owner-form";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ code: string; leadId: string }>;
}) {
  const { code, leadId } = await params;
  const ctx = await requireCompanyPageByCode(code, "lead.view");

  let lead: Awaited<ReturnType<typeof getLeadDetail>>;
  try {
    lead = await getLeadDetail(ctx.actor.id, ctx.company.id, leadId);
  } catch (err) {
    if (!(err instanceof AuthorizationError)) console.error("customers/leads/[leadId] lỗi không mong đợi:", err);
    notFound();
  }

  const canConvert = ctx.permissions.has("lead.convert") && lead.status !== "CONVERTED" && lead.status !== "LOST";
  const canAssign = ctx.permissions.has("lead.assign");

  const members = canAssign
    ? await db.companyMembership.findMany({
        where: { companyId: ctx.company.id, status: "ACTIVE" },
        include: { user: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/c/${code}/customers/leads`} className="text-sm text-zinc-900 hover:underline">
          ← Lead
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-zinc-900">{lead.name}</h2>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
            {LEAD_STATUS_LABEL[lead.status] ?? lead.status}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
          <span>Điện thoại: {lead.phone ?? "—"}</span>
          <span>Email: {lead.email ?? "—"}</span>
          <span>Nguồn: {lead.source?.name ?? "—"}</span>
          <span>Người phụ trách: {lead.owner?.displayName ?? "—"}</span>
        </div>
      </div>

      {lead.status === "CONVERTED" && lead.convertedCustomerId ? (
        <Link
          href={`/c/${code}/customers/${lead.convertedCustomerId}`}
          className="text-sm text-zinc-900 hover:underline"
        >
          Xem khách hàng đã chuyển đổi →
        </Link>
      ) : canConvert ? (
        <ConvertLeadButton companyId={ctx.company.id} leadId={lead.id} code={code} />
      ) : null}

      {canAssign ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-zinc-900">Đổi người phụ trách</h3>
          <LeadOwnerForm
            companyId={ctx.company.id}
            leadId={lead.id}
            currentOwnerUserId={lead.ownerUserId}
            members={members.map((m) => ({ id: m.userId, displayName: m.user.displayName }))}
          />
        </section>
      ) : null}
    </div>
  );
}
