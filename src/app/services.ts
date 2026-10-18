// Orchestration used by the TUI screens. Each function is one user-visible step.
import { extractCv } from '../cv/extract.js';
import { parseCv } from '../cv/parse.js';
import { resolveGithubToken } from '../github/auth.js';
import { fetchRepos } from '../github/fetch.js';
import { profileToResume, renderResume } from '../latex/render.js';
import { findTectonic, fitToOnePage } from '../output/compile.js';
import { saveOutputs, type SavedFiles } from '../output/save.js';
import type { Provider } from '../providers/types.js';
import type { Profile } from '../schemas/profile.js';
import type { Repo, RepoCache } from '../schemas/repo.js';
import type { Resume } from '../schemas/tailored.js';
import { loadConfig, saveConfig, saveProfile, saveRepos, writeText, type Config } from '../store/index.js';
import { paths } from '../store/paths.js';
import { rankRepos, type RankedRepo } from '../tailor/rank.js';
import { roleSlug } from '../tailor/roles.js';
import { buildResume, tailorResume } from '../tailor/tailor.js';
import type { Target } from '../tailor/target.js';

export async function syncGithub(token: string, includePrivate: boolean): Promise<RepoCache> {
  const cache = await fetchRepos(token, { includePrivate });
  await saveRepos(cache);
  const config = await loadConfig();
  await saveConfig({ ...config, githubLogin: cache.login, includePrivate });
  return cache;
}

/** Resolve a token from gh/env, or use the one the user typed. */
export async function getGithubToken(manual?: string): Promise<string | null> {
  if (manual?.trim()) return manual.trim();
  return (await resolveGithubToken())?.token ?? null;
}

export async function importCv(provider: Provider, file: string): Promise<Profile> {
  const cv = await extractCv(file);
  return parseCv(provider, cv);
}

/** Persist the parsed profile and its untailored LaTeX rendering. */
export async function saveBaseResume(profile: Profile): Promise<string> {
  await saveProfile(profile);
  const tex = renderResume(profileToResume(profile));
  await writeText(paths.baseTex, tex);
  return tex;
}

export const MAX_RANKED = 4;

export async function rank(provider: Provider, target: Target, repos: Repo[]): Promise<RankedRepo[]> {
  return rankRepos(provider, target, repos);
}

export interface TailorDraft {
  resume: Resume;
  warnings: string[];
  repos: Repo[];
  /** Repo name behind each resume project (null for CV-only projects), same order. */
  projectRefs: Array<string | null>;
}

export async function tailor(provider: Provider, target: Target, profile: Profile, repos: Repo[]): Promise<TailorDraft> {
  const { result, warnings } = await tailorResume(provider, target, profile, repos);
  return {
    resume: buildResume(profile, repos, result),
    warnings,
    repos,
    projectRefs: result.projects.map((p) => (p.source === 'repo' ? p.ref : null)),
  };
}

export interface Finalized {
  files: SavedFiles;
  tex: string;
  pages: number | null;
  shrinkLevel: number;
  compileError: string | null;
}

/** Render → (optionally) compile & fit to one page → save. */
export async function finalize(target: Target, resume: Resume): Promise<Finalized> {
  const tectonic = await findTectonic();
  let tex = renderResume(resume);
  let pdf: Buffer | null = null;
  let pages: number | null = null;
  let shrinkLevel = 0;
  let compileError: string | null = null;
  let finalResume = resume;
  if (tectonic) {
    try {
      const fit = await fitToOnePage(tectonic, resume);
      ({ tex, pdf, pages } = fit);
      shrinkLevel = fit.level;
      finalResume = fit.resume;
    } catch (err) {
      compileError = err instanceof Error ? err.message : String(err);
    }
  }
  const files = await saveOutputs(roleSlug(target.role), finalResume, tex, pdf);
  return { files, tex, pages, shrinkLevel, compileError };
}

export type { Config };
