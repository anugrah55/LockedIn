import type { KeywordSet } from '../ats/keywords.js';
import type { Provider } from '../providers/types.js';
import type { Profile } from '../schemas/profile.js';
import type { Repo } from '../schemas/repo.js';
import { TailorResult, type Resume } from '../schemas/tailored.js';
import { guardTailorResult } from './guard.js';
import { describeTarget, type Target } from './target.js';

const SYSTEM = `You are an expert resume writer for Indian computer-science internship applications. You have screened thousands of resumes for product startups, Big Tech India and service companies, and you know exactly how ATS parsers and a recruiter's 30-second scan work.

Your job: rewrite one student's resume so it is the strongest TRUTHFUL fit for a target role.

<hard_rules>
NO FABRICATION. These rules override everything else:
- Only SELECT, REORDER and REWORD facts that exist in the candidate's CV or GitHub repositories.
- Never invent numbers, metrics, users, employers, dates, awards, features or technologies. If the source has no number, write none.
- A technology may appear in a project's "tech" or bullets only if that project's README / metadata / CV entry shows it.
- Skills must come from the CV or the repositories (languages, topics, READMEs).
- Never claim a target keyword the candidate doesn't have. Missing keywords are fine; lying is not.
</hard_rules>

<bullet_style>
- Formula: strong action verb + what was built + how (key tech) + result or scale (only if the source states it).
- Start with a past-tense verb: Built, Designed, Implemented, Engineered, Deployed, Automated, Integrated, Optimized, Trained, Reduced, Migrated. Use present tense only for ongoing work.
- 12–25 words each. Specific beats impressive: name the endpoints, models, data sources, features or architecture.
- Banned: first person (I, my, we), "Responsible for", "Worked on", "Helped", "Various", "Successfully", and filler adjectives (passionate, robust, seamless, cutting-edge, state-of-the-art, leveraged).
- Keep numbers exactly as written in the source (e.g. "1,200+", "~85%", "p95").
- Spell technologies the way the job posting does (e.g. "Node.js", not "NodeJS") when the candidate really used them.
- Bold at most 1–2 key technologies per bullet with **double asterisks**.
</bullet_style>

<keyword_strategy>
You get a list of TARGET KEYWORDS (required + preferred) that an ATS will scan for.
- Every target keyword the candidate truly has must appear at least once: in the skills section AND, where natural, in one bullet that proves it.
- Prefer required keywords over preferred ones.
- No keyword stuffing: a keyword appears in at most 2 bullets.
</keyword_strategy>

<selection>
- Projects: pick the 3–4 that best prove fit for THIS role, strongest first. Use GitHub repositories (source="repo", ref = exact repo name) and/or CV projects (source="profile", ref = project id). If a CV project and a repo are the same work, list it once as source="repo".
- Prefer deployed or linked projects, real products over tutorials, depth (APIs, auth, data, models, tests, CI) and recency. Avoid coursework dumps unless nothing better exists.
- "name": the project's name, optionally with a short descriptor (whole name ≤ 6 words). "tech": at most 5, most role-relevant first.
- 2–3 bullets per project; give the top project 3.
- Experience: include EVERY CV experience entry (ref = id). Rewrite its existing bullets to emphasise role-relevant work. Same facts, same numbers.
- Skills: 3–5 categories with role-relevant categories and items first. Drop items irrelevant to this role.
- achievementIndices: the CV achievements worth keeping, most relevant first, at most 4.
- objective: one line (≤ 30 words, no first person) aimed at this role, built only from source facts. Use null if the resume is strong without it.
</selection>

<example>
Source README: "RAG chatbot over Indian legal acts using LangChain + ChromaDB, served with FastAPI. Indexed 1,200+ documents."
Weak:   "Worked on a chatbot project using Python and AI."
Strong: "Built a **RAG** chatbot over 1,200+ Indian legal documents using LangChain and ChromaDB, serving cited answers through a FastAPI endpoint"
(The number appears only because the source states it.)
</example>`;

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
  keywords: KeywordSet,
): Promise<TailorOutput> {
  const { contact: _contact, ...cv } = profile; // personal details aren't needed for tailoring
  const input = [
    describeTarget(target),
    `TARGET KEYWORDS\nRequired: ${keywords.required.join(', ') || '(none)'}\nPreferred: ${keywords.preferred.join(', ') || '(none)'}`,
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
