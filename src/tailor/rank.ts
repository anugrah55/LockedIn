import type { Provider } from '../providers/types.js';
import type { Repo } from '../schemas/repo.js';
import { RankResult } from '../schemas/tailored.js';
import { describeTarget, type Target } from './target.js';

export interface RankedRepo {
  repo: Repo;
  score: number;
  reason: string;
}

const SYSTEM = `You are a senior tech recruiter in India screening internship applications. Given a candidate's GitHub repositories and a target role, score how strongly each repository PROVES skills relevant to that role.

<rubric>
- Relevance (50%): is the project in the role's domain, using its core tools and concepts?
- Depth (30%): real engineering such as APIs, auth, data pipelines, models, tests, CI, deployment, or non-trivial architecture.
- Credibility (20%): a clear README, deployed/live link, pinned, recent activity, stars.
</rubric>

<rules>
- Judge only from the provided metadata and README. Never assume features that are not described.
- Penalise coursework/assignment dumps, tutorial clones, empty or template READMEs, and repos unrelated to the role.
- Return every repository that scores 30 or more, best first.
- "reason": one concrete sentence naming the specific evidence (tech, feature or deployment) that makes it fit.
</rules>`;

function summarize(r: Repo): string {
  return [
    `## ${r.name}${r.isPinned ? ' (pinned)' : ''}`,
    r.description ? `Description: ${r.description}` : null,
    `Languages: ${r.languages.join(', ') || 'unknown'}`,
    r.topics.length ? `Topics: ${r.topics.join(', ')}` : null,
    `Stars: ${r.stars} · Last push: ${r.pushedAt.slice(0, 10)}`,
    r.readme ? `README excerpt:\n${r.readme.slice(0, 1500)}` : 'README: (none)',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function rankRepos(provider: Provider, target: Target, repos: Repo[]): Promise<RankedRepo[]> {
  if (!repos.length) return [];
  const input = [describeTarget(target), '', `REPOSITORIES (${repos.length}):`, '', ...repos.map(summarize)].join('\n\n');
  const out = await provider.runStructured({ system: SYSTEM, input, schema: RankResult });
  const byName = new Map(repos.map((r) => [r.name.toLowerCase(), r]));
  const seen = new Set<string>();
  return out.picks
    .map((p) => ({ repo: byName.get(p.repo.toLowerCase()), score: Math.max(0, Math.min(100, p.score)), reason: p.reason }))
    .filter((p): p is RankedRepo => {
      if (!p.repo || seen.has(p.repo.name)) return false;
      seen.add(p.repo.name);
      return true;
    })
    .sort((a, b) => b.score - a.score);
}

/** Strongest repos to feature: up to `max` scoring ≥ `minScore`, but never fewer than 2. */
export function selectTop(ranked: RankedRepo[], max = 4, minScore = 50): Repo[] {
  const strong = ranked.filter((r) => r.score >= minScore).slice(0, max);
  return (strong.length >= 2 ? strong : ranked.slice(0, Math.min(2, max))).map((r) => r.repo);
}
