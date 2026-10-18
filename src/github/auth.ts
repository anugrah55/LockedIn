import { execa } from 'execa';

export interface GithubToken {
  token: string;
  source: 'gh' | 'env' | 'manual';
}

/** Token resolution order: `gh auth token` → $GITHUB_TOKEN / $GH_TOKEN. Null → ask the user for a PAT. */
export async function resolveGithubToken(): Promise<GithubToken | null> {
  try {
    const { stdout, exitCode } = await execa('gh', ['auth', 'token'], { timeout: 10_000, reject: false });
    if (exitCode === 0 && stdout.trim()) return { token: stdout.trim(), source: 'gh' };
  } catch {
    // gh not installed — fall through
  }
  const env = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (env?.trim()) return { token: env.trim(), source: 'env' };
  return null;
}

export const PAT_URL =
  'https://github.com/settings/tokens/new?description=LockedIn&scopes=repo,read:user';
