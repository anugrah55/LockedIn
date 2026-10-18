import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { Profile } from '../schemas/profile.js';
import { RepoCache } from '../schemas/repo.js';
import { paths } from './paths.js';

export const ProviderName = z.enum(['claude', 'codex']);
export type ProviderName = z.infer<typeof ProviderName>;

export const Config = z.object({
  provider: ProviderName.nullable(),
  model: z.string().nullable(),
  includePrivate: z.boolean(),
  githubLogin: z.string().nullable(),
});
export type Config = z.infer<typeof Config>;

export const defaultConfig: Config = {
  provider: null,
  model: null,
  includePrivate: false,
  githubLogin: null,
};

async function readJson<T>(file: string, schema: z.ZodType<T>): Promise<T | null> {
  let text: string;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  const parsed = schema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    throw new Error(`${file} is invalid: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export async function writeText(file: string, text: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text, 'utf8');
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await writeText(file, JSON.stringify(data, null, 2) + '\n');
}

export async function loadConfig(): Promise<Config> {
  return (await readJson(paths.config, Config)) ?? { ...defaultConfig };
}
export const saveConfig = (c: Config) => writeJson(paths.config, c);

export const loadProfile = () => readJson(paths.profile, Profile);
export const saveProfile = (p: Profile) => writeJson(paths.profile, p);

export const loadRepos = () => readJson(paths.repos, RepoCache);
export const saveRepos = (r: RepoCache) => writeJson(paths.repos, r);

export { writeJson };
