import { z } from 'zod';

export const Repo = z.object({
  name: z.string(),
  nameWithOwner: z.string(),
  description: z.string().nullable(),
  url: z.string(),
  homepage: z.string().nullable(),
  primaryLanguage: z.string().nullable(),
  languages: z.array(z.string()),
  topics: z.array(z.string()),
  stars: z.number(),
  isPrivate: z.boolean(),
  isFork: z.boolean(),
  isPinned: z.boolean(),
  pushedAt: z.string(),
  readme: z.string().nullable(),
});

export const RepoCache = z.object({
  login: z.string(),
  fetchedAt: z.string(),
  includePrivate: z.boolean(),
  repos: z.array(Repo),
});

export type Repo = z.infer<typeof Repo>;
export type RepoCache = z.infer<typeof RepoCache>;
