import fs from 'node:fs';
import path from 'node:path';
import { Profile } from '../src/schemas/profile.js';
import type { Repo } from '../src/schemas/repo.js';

export const fixtureProfile = (): Profile =>
  Profile.parse(JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/profile.json'), 'utf8')));

export function makeRepo(over: Partial<Repo> & { name: string }): Repo {
  return {
    nameWithOwner: `priyasharma/${over.name}`,
    description: null,
    url: `https://github.com/priyasharma/${over.name}`,
    homepage: null,
    primaryLanguage: null,
    languages: [],
    topics: [],
    stars: 0,
    isPrivate: false,
    isFork: false,
    isPinned: false,
    pushedAt: '2025-08-01T00:00:00Z',
    readme: null,
    ...over,
  };
}
