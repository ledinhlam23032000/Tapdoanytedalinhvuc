import Link from "next/link";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { getActorEcosystems } from "@/lib/authorization/actor-ecosystems";
import { getAccessibleCompanies } from "@/lib/authorization/company-context";
import { resolveEcosystemPermissions } from "@/lib/permissions/resolver";
import { logoutAction } from "@/lib/actions/auth-actions";
import { CreateCompanyForm } from "./create-company-form";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  ACTIVE: "Hoạt động",
  SUSPENDED: "Tạm dừng",
  ARCHIVED: "Lưu trữ",
};

export default async function EcosystemHomePage() {
  const actor = await requireCurrentActor();
  const ecosystems = await getActorEcosystems(actor.id);

  if (ecosystems.length === 0) {
    return (
      <main className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-zinc-600">
          Tài khoản của bạn chưa thuộc hệ sinh thái hoặc công ty nào. Liên hệ Founder để được cấp quyền.
        </p>
        <form action={logoutAction}>
          <button className="text-sm text-zinc-500 underline">Đăng xuất</button>
        </form>
      </main>
    );
  }

  // Phase 3: single-ecosystem deployment — chọn ecosystem đầu tiên (mục CXXV).
  const ecosystem = ecosystems[0];
  const [companies, permissions] = await Promise.all([
    getAccessibleCompanies(actor.id, ecosystem.id),
    resolveEcosystemPermissions(actor.id, ecosystem.id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-500">{ecosystem.name}</p>
          <h1 className="text-xl font-semibold text-zinc-900">Công ty</h1>
        </div>
        <form action={logoutAction}>
          <button className="text-sm text-zinc-500 underline">
            {actor.displayName} · Đăng xuất
          </button>
        </form>
      </header>

      <ul className="flex flex-col gap-2">
        {companies.map((company) => (
          <li key={company.id}>
            <Link
              href={`/c/${company.code}`}
              className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-4 py-3 hover:border-zinc-400"
            >
              <span className="font-medium text-zinc-900">{company.name}</span>
              <span className="text-sm text-zinc-500">{STATUS_LABEL[company.status] ?? company.status}</span>
            </Link>
          </li>
        ))}
        {companies.length === 0 ? (
          <li className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
            Chưa có công ty nào.
          </li>
        ) : null}
      </ul>

      {permissions.has("ecosystem.company.create") ? (
        <CreateCompanyForm ecosystemId={ecosystem.id} />
      ) : null}
    </main>
  );
}
