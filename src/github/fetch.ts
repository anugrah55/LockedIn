import type { Repo, RepoCache } from '../schemas/repo.js';

const README_LIMIT = 4000;

const QUERY = /* GraphQL */ `
  query ($cursor: String, $privacy: RepositoryPrivacy) {
    viewer {
      login
      pinnedItems(first: 6, types: REPOSITORY) {
        nodes { ... on Repository { nameWithOwner } }
      }
      repositories(
        first: 50
        after: $cursor
        ownerAffiliations: [OWNER]
        privacy: $privacy
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        pageInfo { hasNextPage endCursor }
        nodes {
          name
          nameWithOwner
          description
          url
          homepageUrl
          isPrivate
          isFork
          stargazerCount
          pushedAt
          primaryLanguage { name }
          languages(first: 8, orderBy: { field: SIZE, direction: DESC }) { nodes { name } }
          repositoryTopics(first: 10) { nodes { topic { name } } }
          readme1: object(expression: "HEAD:README.md") { ... on Blob { text } }
          readme2: object(expression: "HEAD:readme.md") { ... on Blob { text } }
          readme3: object(expression: "HEAD:Readme.md") { ... on Blob { text } }
          readme4: object(expression: "HEAD:README") { ... on Blob { text } }
        }
      }
    }
  }
`;

interface RepoNode {
  name: string;
  nameWithOwner: string;
  description: string | null;
  url: string;
  homepageUrl: string | null;
  isPrivate: boolean;
  isFork: boolean;
  stargazerCount: number;
  pushedAt: string;
  primaryLanguage: { name: string } | null;
  languages: { nodes: { name: string }[] };
  repositoryTopics: { nodes: { topic: { name: string } }[] };
  readme1: { text?: string } | null;
  readme2: { text?: string } | null;
  readme3: { text?: string } | null;
  readme4: { text?: string } | null;
}

interface QueryResult {
  data?: {
    viewer: {
      login: string;
      pinnedItems: { nodes: { nameWithOwner?: string }[] };
      repositories: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: RepoNode[] };
    };
  };
  errors?: { message: string }[];
}

export class GithubError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GithubError';
  }
}

/** Strip badges, images and HTML from a README so the LLM sees prose, not noise. */
export function cleanReadme(text: string | undefined | null): string | null {
  if (!text) return null;
  const cleaned = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '') // linked badges
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/<img[^>]*>/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!cleaned) return null;
  return cleaned.length > README_LIMIT ? cleaned.slice(0, README_LIMIT) + '\n…(truncated)' : cleaned;
}

export async function fetchRepos(
  token: string,
  opts: { includePrivate: boolean; includeForks?: boolean; fetchImpl?: typeof fetch },
): Promise<RepoCache> {
  const doFetch = opts.fetchImpl ?? fetch;
  const repos: Repo[] = [];
  let login = '';
  let pinned = new Set<string>();
  let cursor: string | null = null;

  for (let page = 0; page < 10; page++) {
    const res = await doFetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'lockedin-cli',
      },
      body: JSON.stringify({
        query: QUERY,
        variables: { cursor, privacy: opts.includePrivate ? null : 'PUBLIC' },
      }),
    });
    if (res.status === 401) throw new GithubError('GitHub token is invalid or expired.', 401);
    if (!res.ok) throw new GithubError(`GitHub API error ${res.status}: ${await res.text()}`, res.status);
    const body = (await res.json()) as QueryResult;
    if (body.errors?.length && !body.data) {
      throw new GithubError(body.errors.map((e) => e.message).join('; '));
    }
    const viewer = body.data!.viewer;
    login = viewer.login;
    if (page === 0) {
      pinned = new Set(viewer.pinnedItems.nodes.map((n) => n.nameWithOwner).filter((n): n is string => !!n));
    }
    for (const n of viewer.repositories.nodes) {
      if (n.isFork && !opts.includeForks) continue;
      repos.push({
        name: n.name,
        nameWithOwner: n.nameWithOwner,
        description: n.description,
        url: n.url,
        homepage: n.homepageUrl || null,
        primaryLanguage: n.primaryLanguage?.name ?? null,
        languages: n.languages.nodes.map((l) => l.name),
        topics: n.repositoryTopics.nodes.map((t) => t.topic.name),
        stars: n.stargazerCount,
        isPrivate: n.isPrivate,
        isFork: n.isFork,
        isPinned: pinned.has(n.nameWithOwner),
        pushedAt: n.pushedAt,
        readme: cleanReadme(n.readme1?.text ?? n.readme2?.text ?? n.readme3?.text ?? n.readme4?.text),
      });
    }
    const info = viewer.repositories.pageInfo;
    if (!info.hasNextPage) break;
    cursor = info.endCursor;
  }

  return { login, fetchedAt: new Date().toISOString(), includePrivate: opts.includePrivate, repos };
}
