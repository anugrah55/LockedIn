import type { Provider } from '../providers/types.js';
import type { Profile } from '../schemas/profile.js';
import type { Repo } from '../schemas/repo.js';
import { TailorResult, type Resume } from '../schemas/tailored.js';
import { guardTailorResult } from './guard.js';
import { describeTarget, type Target } from './target.js';

const SYSTEM = `You tailor a student's resume for a specific internship role. You are an expert resume writer for Indian tech internships and you know how ATS keyword screening works.

ABSOLUTE RULE — NO FABRICATION:
- You may only SELECT, REORDER and REWORD material that exists in the candidate's CV and GitHub repositories.
- Never invent metrics, numbers, users, employers, dates, awards, features or technologies. If a number is not in the source, do not write one.
- A technology may be listed for a project only if that project's README/metadata/CV entry shows it.
- Skills must come from the CV or the repositories' languages/topics/READMEs.

WHAT TO DO:
1. Projects: choose the 3–4 projects that best prove fit for the role, best first. Use the provided GitHub repositories (source="repo", ref=exact repo name) and/or CV projects (source="profile", ref=project id). If a CV project and a repo are the same thing, list it once as source="repo".
   "name" is the project's name, optionally with a short descriptor (whole name ≤ 6 words). "tech" lists at most 5 technologies, most role-relevant first.
2. Write 2–3 bullets per project (max ~25 words each): strong action verb + what was built + how (tech) + outcome only if stated in source. Lead with the aspects most relevant to the role. Mirror the role/JD's vocabulary where it is truthful.
3. Experience: for every CV experience entry (ref = id) rewrite its existing bullets to emphasise role-relevant work. Same facts, same numbers, no additions.
4. Skills: 3–5 categories, most role-relevant categories and items first. Drop clearly irrelevant items.
5. achievementIndices: indices of CV achievements worth keeping (most relevant first, at most 4).
6. objective: one line (≤ 30 words) aimed at this role, built only from facts in the source — or null if the CV is strong without it.
7. You may wrap 1–2 key technologies per bullet in **double asterisks** for bold. Do not overuse.`;

function repoBlock(r: Repo): string {
  return [
    `## repo: ${r.name}`,
    r.description ? `Description: ${r.description}` : null,
    `Languages: ${r.languages.join(', ') || 'unknown'}`,
    r.topics.length ? `Topics: ${r.topics.join(', ')}` : null,
    r.homepage ? `Live: ${r.homepage}` : null,
    r.readme ? `README:\n${r.readme}` : 'README: (none)',
  ]
    .filter(Boolean)
    .join('\n');
}

export interface TailorOutput {
  result: TailorResult;
  warnings: string[];
}

export async function tailorResume(
  provider: Provider,
  target: Target,
  profile: Profile,
  repos: Repo[],
): Promise<TailorOutput> {
  const { contact: _contact, ...cv } = profile; // personal details aren't needed for tailoring
  const input = [
    describeTarget(target),
    'CANDIDATE CV (JSON):',
    JSON.stringify(cv, null, 2),
    `SELECTED GITHUB REPOSITORIES (${repos.length}):`,
    ...repos.map(repoBlock),
  ].join('\n\n');
  const raw = await provider.runStructured({ system: SYSTEM, input, schema: TailorResult });
  return guardTailorResult(raw, profile, repos);
}

/** Resolve a guarded TailorResult against real data into a renderable Resume. */
export function buildResume(profile: Profile, repos: Repo[], t: TailorResult): Resume {
  const repoByName = new Map(repos.map((r) => [r.name.toLowerCase(), r]));
  const projById = new Map(profile.projects.map((p) => [p.id, p]));
  const bulletsByExp = new Map(t.experience.map((x) => [x.ref, x.bullets]));
  const achievementIdx = t.achievementIndices.length
    ? t.achievementIndices
    : profile.achievements.map((_, i) => i).slice(0, 4);

  return {
    contact: profile.contact,
    objective: t.objective,
    education: profile.education,
    experience: profile.experience.map(({ id, ...x }) => ({ ...x, bullets: bulletsByExp.get(id) ?? x.bullets })),
    projects: t.projects.flatMap((p) => {
      if (p.source === 'repo') {
        const repo = repoByName.get(p.ref.toLowerCase());
        if (!repo) return [];
        // Private repo URLs 404 for recruiters; only link what they can open.
        const link = repo.homepage ?? (repo.isPrivate ? null : repo.url);
        return [{ name: p.name, tech: p.tech, link, date: null, bullets: p.bullets }];
      }
      const pp = projById.get(p.ref);
      if (!pp) return [];
      return [{ name: p.name, tech: p.tech, link: pp.link, date: pp.date, bullets: p.bullets }];
    }),
    skills: t.skills,
    achievements: achievementIdx.flatMap((i) => profile.achievements[i] ?? []),
    certifications: profile.certifications,
  };
}
