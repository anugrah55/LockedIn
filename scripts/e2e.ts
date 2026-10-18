/**
 * Headless end-to-end run of the full pipeline against real services.
 * Usage: LOCKEDIN_HOME=/tmp/x npx tsx scripts/e2e.ts <cv-file> [role-id ...]
 */
import { finalize, importCv, saveBaseResume, syncGithub, tailor, rank, MAX_RANKED } from '../src/app/services.js';
import { resolveGithubToken } from '../src/github/auth.js';
import { createProvider } from '../src/providers/index.js';
import { ROLES } from '../src/tailor/roles.js';

const [cvFile, ...roleIds] = process.argv.slice(2);
if (!cvFile) throw new Error('usage: e2e.ts <cv-file> [role-id ...]');
const provider = createProvider({ provider: (process.env.LOCKEDIN_PROVIDER as 'claude' | 'codex') ?? 'claude', model: null });
const t = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`;
const t0 = Date.now();

const profile = await importCv(provider, cvFile);
await saveBaseResume(profile);
console.log(`[${t()}] parsed CV: ${profile.contact.name} · ${profile.experience.length} exp · ${profile.projects.length} projects · ${profile.skills.length} skill groups`);

const token = (await resolveGithubToken())!.token;
const cache = await syncGithub(token, false);
console.log(`[${t()}] github: ${cache.repos.length} repos`);

for (const id of roleIds.length ? roleIds : ['backend']) {
  const role = ROLES.find((r) => r.id === id)!;
  const target = { role, jobDescription: null };
  const ranked = await rank(provider, target, cache.repos);
  console.log(`\n[${t()}] ${role.title} — ranked:`);
  for (const r of ranked.slice(0, 6)) console.log(`   ${String(r.score).padStart(3)}  ${r.repo.name} — ${r.reason}`);
  const draft = await tailor(provider, target, profile, ranked.slice(0, MAX_RANKED).map((r) => r.repo));
  console.log(`[${t()}] tailored: projects = ${draft.resume.projects.map((p) => `${p.name} [${p.tech.join(', ')}]`).join(' | ')}`);
  console.log(`   skills: ${draft.resume.skills.map((g) => `${g.category}: ${g.items.join(', ')}`).join(' ; ')}`);
  console.log(`   objective: ${draft.resume.objective}`);
  console.log(`   guard warnings (${draft.warnings.length}):`);
  for (const w of draft.warnings) console.log(`     - ${w}`);
  const out = await finalize(target, draft.resume);
  console.log(`[${t()}] saved ${out.files.tex} · pdf=${out.files.pdf} · pages=${out.pages} · shrink=${out.shrinkLevel} · compileError=${out.compileError}`);
}
