import Link from "next/link";
import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { isHealthcareModuleEnabled } from "@/lib/domain/healthcare/module-service";
import { getMedicalCaseList } from "@/lib/domain/healthcare/medical-case-service";
import { getCustomerList } from "@/lib/domain/customer-service";
import { MEDICAL_CASE_STATUS_LABEL, MEDICAL_CASE_TYPE_LABEL, formatDateTime } from "../work-labels";
import { CreateMedicalCaseForm } from "./create-medical-case-form";

export const dynamic = "force-dynamic";

export default async function HealthcarePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ctx = await requireCompanyPageByCode(code, "healthcare.case.view");

  const canManageModule = ctx.permissions.has("healthcare.module.manage");

  // Cổng thứ hai độc lập với permission (ADR-047, mirror module-service):
  // có quyền healthcare.case.view mà Company chưa bật phân hệ Y tế thì vẫn
  // không được gọi getMedicalCaseList — chỉ hiện thông báo rồi dừng.
  const moduleEnabled = await isHealthcareModuleEnabled(ctx.company.id);
  if (!moduleEnabled) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-zinc-900">Y tế</h2>
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
          Công ty chưa bật phân hệ Y tế. Liên hệ chủ sở hữu tại{" "}
          {canManageModule ? (
            <Link href={`/c/${code}/healthcare/settings`} className="text-zinc-900 hover:underline">
              /c/{code}/healthcare/settings
            </Link>
          ) : (
            `/c/${code}/healthcare/settings`
          )}
          .
        </p>
      </div>
    );
  }

  const canCreate = ctx.permissions.has("healthcare.case.create");

  const [cases, customers] = await Promise.all([
    getMedicalCaseList(ctx.actor.id, ctx.company.id),
    canCreate ? getCustomerList(ctx.actor.id, ctx.company.id) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Y tế</h2>
          <p className="text-sm text-zinc-500">Hồ sơ ca khám/điều trị của công ty.</p>
        </div>
        {canManageModule ? (
          <Link href={`/c/${code}/healthcare/settings`} className="text-sm text-zinc-900 hover:underline">
            Cài đặt phân hệ Y tế →
          </Link>
        ) : null}
      </div>

      {canCreate ? (
        <div className="max-w-xl">
          <h3 className="mb-2 text-sm font-semibold text-zinc-900">Mở hồ sơ ca mới</h3>
          <CreateMedicalCaseForm
            companyId={ctx.company.id}
            customers={customers.map((c) => ({ id: c.id, name: c.name }))}
          />
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">Danh sách hồ sơ</h3>
        {cases.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
            Chưa có hồ sơ ca nào.
          </p>
        ) : (
          <section className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="px-4 py-2 font-medium">Tên khách hàng</th>
                  <th className="px-4 py-2 font-medium">Loại ca</th>
                  <th className="px-4 py-2 font-medium">Trạng thái</th>
                  <th className="px-4 py-2 font-medium">Bác sĩ phụ trách</th>
                  <th className="px-4 py-2 font-medium">Ngày mở</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((record) => (
                  <tr key={record.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-2">
                      <Link href={`/c/${code}/healthcare/${record.id}`} className="text-zinc-900 hover:underline">
                        {record.customer.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-zinc-700">
                      {MEDICAL_CASE_TYPE_LABEL[record.caseType] ?? record.caseType}
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                        {MEDICAL_CASE_STATUS_LABEL[record.status] ?? record.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-zinc-700">{record.primaryClinician?.displayName ?? "—"}</td>
                    <td className="px-4 py-2 text-zinc-700">{formatDateTime(record.openedAt.toISOString())}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </section>
    </div>
  );
}
