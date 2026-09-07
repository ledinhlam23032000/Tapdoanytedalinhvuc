/**
 * Sinh phan AUTO cua `docs/project/NAVIGATION.md`.
 *
 * NGAN SACH TOKEN LA RANG BUOC THIET KE, khong phai chi tiet phu.
 * Ban dau script nay sinh ra ca danh sach export (~12k token) — DOC no con
 * dat hon la grep, tuc la phan tac dung. Da cat bo.
 *
 * Nguyen tac: CHI dua vao day nhung thu `rg` KHONG thay the duoc re hon —
 * tuc la thu can "quet tong the de biet co ton tai chua", chu khong phai
 * thu da biet ten va chi can tim vi tri.
 *  - ADR one-liner  -> tra loi "da chot quyet dinh X chua" (hoi nhieu nhat)
 *  - Prisma model   -> biet co model nao truoc khi dinh tao model moi
 *  - Permission key -> biet key nao ton tai truoc khi them key moi
 * KHONG dua vao: danh sach export (dung `rg` tim), section map cua bat ky
 * doc nao (mot lenh `rg -n "^## " <file>` re hon).
 *
 * Chay: `npm run nav`. Idempotent — chi ghi de giua 2 marker AUTO.
 * Zero dependency: repo ~16k dong code that, khong dang cai ctags/repomix.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const NAV = join(ROOT, "docs", "project", "NAVIGATION.md");
const START = "<!-- AUTO:START -->";
const END = "<!-- AUTO:END -->";
/** Vuot nguong nay nghia la index dang phinh lai thanh thu no muon thay the. */
const BUDGET_TOKENS = 4000;

const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8").split(/\r?\n/);

/** Quet 1 file, tra ve [so dong 1-indexed, nhom bat duoc]. */
function scan(rel: string[], re: RegExp): { line: number; text: string }[] {
  const hits: { line: number; text: string }[] = [];
  read(...rel).forEach((l, i) => {
    const m = l.match(re);
    if (m) hits.push({ line: i + 1, text: m[1] ?? m[0] });
  });
  return hits;
}

const out: string[] = [];

// ---- ADR: cau hoi lap lai nhieu nhat la "da chot quyet dinh X chua" ----
const adrs = scan(["docs", "architecture", "DECISIONS.md"], /^## (ADR-\d+.*)$/);
out.push(`### ${adrs.length} ADR — \`docs/architecture/DECISIONS.md:<dòng>\`\n`);
// Cat tieu de con 60 ky tu: du de biet CO NEN nhay toi ADR do khong, khong
// du de thay the viec doc no. Tieu de day du dai trung binh ~110 ky tu ->
// cat di ~500 token, giu index trong ngan sach khi so ADR tang.
for (const a of adrs) {
  const t = a.text.replace(/`/g, "");
  out.push(`\`:${a.line}\` ${t.length > 60 ? t.slice(0, 60) + "…" : t}`);
}

// ---- Prisma: biet co gi truoc khi dinh tao model moi ----
const models = scan(["prisma", "schema.prisma"], /^model (\w+)/);
const enums = scan(["prisma", "schema.prisma"], /^enum (\w+)/);
out.push(`\n### Prisma \`prisma/schema.prisma\` — ${models.length} model, ${enums.length} enum\n`);
out.push("**Model** " + models.map((m) => `${m.text}\`:${m.line}\``).join(" · "));
out.push("\n**Enum** " + enums.map((m) => `${m.text}\`:${m.line}\``).join(" · "));

// ---- Permission: biet key nao ton tai truoc khi them key moi ----
const perms = scan(["src", "lib", "permissions", "registry.ts"], /^\s*"([a-z]+\.[a-z.]+)",/);
out.push(`\n### ${perms.length} permission key — \`src/lib/permissions/registry.ts\`\n`);
out.push(perms.map((p) => p.text).join(" · "));

// Section map cua 8 doc phai sua moi Phan DA BI CAT khoi index: mot lenh
// `rg -n "^## " <8 file>` thay the duoc no re hon, ma nguyen tac cua chinh
// file nay la CHI giu thu rg khong thay the duoc. Cong thuc rg nam trong
// phan viet tay cua NAVIGATION.md.

const body = `${START}\n<!-- SINH TU DONG boi scripts/gen-nav-index.ts — dung sua tay, chay \`npm run nav\` -->\n\n${out.join("\n")}\n\n${END}`;
const cur = readFileSync(NAV, "utf8");
const i = cur.indexOf(START);
const j = cur.indexOf(END);
if (i === -1 || j === -1) throw new Error(`Thieu marker ${START}/${END} trong ${NAV}`);
writeFileSync(NAV, cur.slice(0, i) + body + cur.slice(j + END.length), "utf8");

const tokens = Math.round(readFileSync(NAV, "utf8").length / 4);
console.log(`NAVIGATION.md: ${adrs.length} ADR, ${models.length} model, ${perms.length} permission — ~${tokens} token`);
if (tokens > BUDGET_TOKENS) {
  console.error(`CANH BAO: ~${tokens} token > ngan sach ${BUDGET_TOKENS}. Index dang phinh — cat bot, dung de no thay the chinh muc dich cua no.`);
  process.exit(1);
}
