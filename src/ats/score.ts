import type { Resume } from '../schemas/tailored.js';
import { Evidence } from '../tailor/evidence.js';
import type { KeywordSet } from './keywords.js';

// Weights out of 100. Keywords dominate because that is what ATS filters on.
export const WEIGHTS = { keywords: 70, impact: 15, structure: 15 } as const;

const ACTION_VERBS = new Set(
  `achieved analyzed architected automated benchmarked built collaborated configured containerized created debugged
  decreased delivered deployed designed developed devised directed drove enabled engineered enhanced established
  evaluated expanded fine-tuned founded generated implemented improved increased integrated introduced launched led
  maintained managed mentored migrated modeled monitored optimized orchestrated organized owned parallelized
  pioneered processed profiled programmed prototyped published reduced refactored researched resolved revamped scaled
  scraped secured shipped simplified spearheaded streamlined structured tested trained transformed tuned visualized wrote
  accelerated added assembled boosted coded composed conducted contributed crafted cut defined documented extended
  extracted fixed handled indexed initiated instrumented hosted mapped merged parsed planned ported produced
  rebuilt redesigned replaced rewrote ran served set sped standardized supported taught upgraded validated won
  build design develop implement maintain lead own create train deploy`.split(/\s+/),
);

const FIRST_PERSON = /\b(i|me|my|mine|we|our)\b/i;

export interface AtsReport {
  total: number;
  keywords: { score: number; matched: string[]; missing: string[]; requiredMissing: string[] };
  impact: { score: number; bullets: number; actionVerb: number; quantified: number };
  structure: { score: number; issues: string[] };
}

const plain = (s: string) => s.replace(/\*\*/g, '');

export function resumeText(r: Resume): string[] {
  return [
    r.objective,
    ...r.skills.flatMap((g) => [g.category, ...g.items]),
    ...r.projects.flatMap((p) => [p.name, ...p.tech, ...p.bullets.map(plain)]),
    ...r.experience.flatMap((x) => [x.title, x.organization, ...x.bullets.map(plain)]),
    ...r.education.flatMap((e) => [e.degree, ...e.coursework]),
    ...r.achievements,
    ...r.certifications,
  ].filter((s): s is string => !!s);
}

export function scoreResume(r: Resume, kw: KeywordSet, opts: { pages?: number | null } = {}): AtsReport {
  // Keywords — required count double.
  const ev = new Evidence(resumeText(r));
  const matched: string[] = [];
  const missing: string[] = [];
  const requiredMissing: string[] = [];
  let got = 0;
  let max = 0;
  for (const [list, weight] of [
    [kw.required, 2],
    [kw.preferred, 1],
  ] as const) {
    for (const k of list) {
      max += weight;
      if (ev.has(k)) {
        got += weight;
        matched.push(k);
      } else {
        missing.push(k);
        if (weight === 2) requiredMissing.push(k);
      }
    }
  }
  const keywordScore = max ? (got / max) * WEIGHTS.keywords : WEIGHTS.keywords;

  // Impact — strong opening verbs and quantified results.
  const bullets = [...r.projects, ...r.experience].flatMap((x) => x.bullets.map(plain));
  const actionVerb = bullets.filter((b) => ACTION_VERBS.has((b.trim().split(/\s+/)[0] ?? '').toLowerCase())).length;
  const quantified = bullets.filter((b) => /\d/.test(b)).length;
  const verbRatio = bullets.length ? actionVerb / bullets.length : 0;
  // 40% of bullets carrying a number is a strong student resume.
  const quantRatio = bullets.length ? Math.min(1, quantified / bullets.length / 0.4) : 0;
  const impactScore = WEIGHTS.impact * (0.5 * verbRatio + 0.5 * quantRatio);

  // Structure — parseable sections and hygiene.
  const issues: string[] = [];
  let structure: number = WEIGHTS.structure;
  const deduct = (pts: number, issue: string) => {
    structure -= pts;
    issues.push(issue);
  };
  if (!r.contact.email) deduct(3, 'No email address');
  if (!r.contact.phone) deduct(2, 'No phone number');
  if (!r.education.length) deduct(3, 'No education section');
  if (!r.skills.length) deduct(3, 'No skills section');
  if (!r.projects.length && !r.experience.length) deduct(4, 'No projects or experience');
  const long = bullets.filter((b) => b.split(/\s+/).length > 35).length;
  if (long) deduct(Math.min(3, long), `${long} bullet${long > 1 ? 's' : ''} over 35 words`);
  if (bullets.some((b) => FIRST_PERSON.test(b))) deduct(2, 'First-person pronouns in bullets');
  if (opts.pages && opts.pages > 1) deduct(3, `${opts.pages} pages — internships expect one`);
  structure = Math.max(0, structure);

  return {
    total: Math.round(keywordScore + impactScore + structure),
    keywords: { score: keywordScore, matched, missing, requiredMissing },
    impact: { score: impactScore, bullets: bullets.length, actionVerb, quantified },
    structure: { score: structure, issues },
  };
}
