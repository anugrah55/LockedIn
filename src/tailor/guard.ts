import type { Profile } from '../schemas/profile.js';
import type { Repo } from '../schemas/repo.js';
import type { TailorResult } from '../schemas/tailored.js';
import { Evidence, extractNumbers } from './evidence.js';

export interface GuardReport {
  result: TailorResult;
  warnings: string[];
}

function repoText(r: Repo): Array<string | null> {
  return [r.name, r.description, r.primaryLanguage, ...r.languages, ...r.topics, r.readme];
}

/** Drop bullets that introduce numbers absent from the source material. */
function checkBullets(bullets: string[], source: string, label: string, warnings: string[]): string[] {
  const known = new Set(extractNumbers(source));
  return bullets.filter((b) => {
    const invented = extractNumbers(b).filter((n) => !known.has(n));
    if (invented.length) {
      warnings.push(`${label}: removed a bullet with unverified number(s) ${invented.join(', ')} — "${b}"`);
      return false;
    }
    return true;
  });
}

/**
 * Enforce "select, reorder, reword — never invent":
 *  - every project must reference a real repo or CV project
 *  - every technology/skill must appear somewhere in the source material
 *  - rewritten bullets may not introduce new numbers
 */
export function guardTailorResult(raw: TailorResult, profile: Profile, repos: Repo[]): GuardReport {
  const warnings: string[] = [];
  const repoByName = new Map(repos.map((r) => [r.name.toLowerCase(), r]));
  const profileProjects = new Map(profile.projects.map((p) => [p.id, p]));
  const experienceById = new Map(profile.experience.map((x) => [x.id, x]));

  const global = new Evidence(
    [
    ...profile.skills.flatMap((g) => g.items),
    ...profile.projects.flatMap((p) => [p.name, ...p.tech, ...p.bullets]),
    ...profile.experience.flatMap((x) => [x.title, ...x.bullets]),
    ...profile.education.flatMap((e) => [e.institution, e.degree, e.location, e.start, e.end, e.score, ...e.coursework]),
    ...profile.experience.flatMap((x) => [x.organization, x.location, x.start, x.end]),
    ...profile.certifications,
    ...profile.achievements,
    profile.summary,
    ],
    { concepts: true },
  );
  for (const r of repos) for (const t of repoText(r)) global.add(t);

  // Projects
  const seen = new Set<string>();
  const projects: TailorResult['projects'] = [];
  for (const p of raw.projects) {
    let evidence: Evidence;
    let source: string;
    if (p.source === 'repo') {
      const repo = repoByName.get(p.ref.toLowerCase());
      if (!repo) {
        warnings.push(`Dropped project "${p.name}": no GitHub repo named "${p.ref}".`);
        continue;
      }
      const texts = repoText(repo);
      // A CV project describing the same repo is valid evidence too.
      const twin = profile.projects.find(
        (pp) => pp.name.toLowerCase() === repo.name.toLowerCase() || (pp.link ?? '').toLowerCase().includes(repo.url.toLowerCase()),
      );
      if (twin) texts.push(twin.name, ...twin.tech, ...twin.bullets);
      evidence = new Evidence(texts, { concepts: true });
      source = texts.filter(Boolean).join('\n');
    } else {
      const pp = profileProjects.get(p.ref);
      if (!pp) {
        warnings.push(`Dropped project "${p.name}": no CV project with id "${p.ref}".`);
        continue;
      }
      evidence = new Evidence([pp.name, ...pp.tech, ...pp.bullets], { concepts: true });
      source = [pp.name, ...pp.tech, ...pp.bullets].join('\n');
    }
    const key = `${p.source}:${p.ref.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const tech = p.tech.filter((t) => {
      if (evidence.has(t)) return true;
      warnings.push(`${p.name}: removed "${t}" (not found in this project's code/README/CV).`);
      return false;
    });
    const bullets = checkBullets(p.bullets, source, p.name, warnings);
    if (!bullets.length) {
      warnings.push(`Dropped project "${p.name}": no verifiable bullets left.`);
      seen.delete(key);
      continue;
    }
    projects.push({ ...p, tech, bullets });
  }

  // Experience: keep every real entry, in CV order; fall back to original bullets.
  const tailoredExp = new Map(raw.experience.map((x) => [x.ref, x.bullets]));
  for (const x of raw.experience) {
    if (!experienceById.has(x.ref)) warnings.push(`Ignored experience "${x.ref}": not in your CV.`);
  }
  const experience = profile.experience.map((x) => {
    const proposed = tailoredExp.get(x.id);
    if (!proposed?.length) return { ref: x.id, bullets: x.bullets };
    const ok = checkBullets(proposed, x.bullets.join('\n'), `${x.title} @ ${x.organization}`, warnings);
    return { ref: x.id, bullets: ok.length ? ok : x.bullets };
  });

  // Skills
  const skills = raw.skills
    .map((g) => ({
      category: g.category,
      items: [...new Set(g.items)].filter((s) => {
        if (global.has(s)) return true;
        warnings.push(`Skills: removed "${s}" (not in your CV or GitHub).`);
        return false;
      }),
    }))
    .filter((g) => g.items.length);

  // Achievements
  const achievementIndices = [...new Set(raw.achievementIndices)].filter(
    (i) => Number.isInteger(i) && i >= 0 && i < profile.achievements.length,
  );

  // Objective: same no-new-numbers rule
  let objective = raw.objective;
  if (objective && extractNumbers(objective).some((n) => !global.has(n))) {
    warnings.push('Removed the summary line: it contained unverified numbers.');
    objective = null;
  }

  return {
    result: { objective, skills, projects, experience, achievementIndices },
    warnings,
  };
}
