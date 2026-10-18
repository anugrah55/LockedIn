// Dev helper: fetch the current user's repos and print a summary.
import { resolveGithubToken } from '../src/github/auth.js';
import { fetchRepos } from '../src/github/fetch.js';

const tok = await resolveGithubToken();
if (!tok) throw new Error('No GitHub token');
const cache = await fetchRepos(tok.token, { includePrivate: false });
console.log(`login=${cache.login} source=${tok.source} repos=${cache.repos.length}`);
for (const r of cache.repos.slice(0, 15)) {
  console.log(`${r.isPinned ? '📌' : '  '} ${r.name.padEnd(32)} ${String(r.primaryLanguage).padEnd(12)} ★${r.stars} readme=${r.readme?.length ?? 0} topics=${r.topics.join(',')}`);
}
