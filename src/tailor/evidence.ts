/**
 * Fuzzy "is this term backed by the source text?" matching.
 * Used by the guard to reject technologies/skills the model invented.
 */

const ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  postgres: 'postgresql',
  psql: 'postgresql',
  mongo: 'mongodb',
  k8s: 'kubernetes',
  sklearn: 'scikitlearn',
  tf: 'tensorflow',
  gcp: 'googlecloud',
  googlecloudplatform: 'googlecloud',
  golang: 'go',
  py: 'python',
  ml: 'machinelearning',
  dl: 'deeplearning',
  llm: 'largelanguagemodel',
  genai: 'generativeai',
  cicd: 'cicd',
  tailwindcss: 'tailwind',
  hf: 'huggingface',
  rn: 'reactnative',
  dsa: 'datastructuresandalgorithm',
};

/** Canonical key for a term: lowercase, no separators, no trailing "js"/version digits/plural "s". */
export function termKey(term: string): string {
  let k = term
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9+#]/g, '');
  const direct = ALIASES[k];
  if (direct) return direct;
  if (k.length > 4 && k.endsWith('js')) k = k.slice(0, -2);
  if (k.length > 3 && /[a-z]/.test(k)) k = k.replace(/\d+$/, '');
  if (k.length > 4 && k.endsWith('s') && !k.endsWith('ss')) k = k.slice(0, -1);
  return ALIASES[k] ?? k;
}

/**
 * Concepts proven by a concrete tool ("Razorpay" proves "payment gateway").
 * Only the truth guard uses these. ATS scoring stays literal, like a real ATS.
 */
const PAYMENT = ['razorpay', 'stripe', 'paypal', 'paytm', 'cashfree', 'phonepe', 'payu', 'upi'];
const CONCEPTS: Record<string, string[]> = {
  paymentgateway: PAYMENT,
  paymentgatewayintegration: PAYMENT,
  paymentintegration: PAYMENT,
  authentication: ['jwt', 'oauth', 'auth', 'firebaseauth', 'passport', 'clerk', 'auth0', 'nextauth', 'login'],
  authorization: ['jwt', 'oauth', 'rbac'],
  containerization: ['docker', 'kubernetes', 'podman'],
  cicd: ['githubaction', 'jenkin', 'gitlabci', 'circleci'],
  vectordatabase: ['chromadb', 'pinecone', 'faiss', 'weaviate', 'qdrant', 'milvus', 'pgvector'],
  largelanguagemodel: ['openai', 'gemini', 'claude', 'llama', 'gpt', 'mistral', 'groq'],
  cloud: ['aws', 'googlecloud', 'azure'],
  nosql: ['mongodb', 'firestore', 'dynamodb', 'cassandra', 'redi'],
  sql: ['postgresql', 'mysql', 'sqlite'],
};

const MAX_NGRAM = 4;
const GENERIC_SUFFIX = /\s+(apis?|sdks?|framework|library|platform|cloud|stack)$/i;

export class Evidence {
  private keys = new Set<string>();

  constructor(
    texts: Array<string | null | undefined> = [],
    private readonly opts: { concepts?: boolean } = {},
  ) {
    for (const t of texts) this.add(t);
  }

  add(text: string | null | undefined): this {
    if (!text) return this;
    const words = text.split(/[\s,;:()[\]{}<>"'`|/\\!?*=]+/).filter(Boolean);
    for (let i = 0; i < words.length; i++) {
      let joined = '';
      for (let n = 0; n < MAX_NGRAM && i + n < words.length; n++) {
        joined += words[i + n];
        const key = termKey(joined);
        if (key) this.keys.add(key);
        // Hyphenated words ("scikit-learn", "real-time") also count piecewise.
        if (n === 0 && words[i]!.includes('-')) {
          for (const part of words[i]!.split('-')) if (part) this.keys.add(termKey(part));
        }
      }
    }
    return this;
  }

  has(term: string): boolean {
    const key = termKey(term);
    if (!key) return false;
    if (this.keys.has(key)) return true;
    if (this.opts.concepts && CONCEPTS[key]?.some((k) => this.keys.has(k))) return true;
    // "ChromaDB (Vector DB)": the parenthetical is a description; the base term must be backed.
    const base = term.replace(/\([^)]*\)/g, '').trim();
    if (base && base !== term.trim()) return this.has(base);
    // "OpenAI API", "Firebase SDK": generic suffixes don't change what was used.
    const stripped = term.replace(GENERIC_SUFFIX, '').trim();
    if (stripped && stripped !== term.trim()) return this.has(stripped);
    // "Pandas/NumPy", "HTML & CSS": accept if every component is backed.
    const parts = term.split(/[,/&+]| and /i).map((s) => s.trim()).filter((s) => s.length > 1);
    return parts.length > 1 && parts.every((p) => this.keys.has(termKey(p)));
  }
}

/** Numbers that carry claims: 40%, 5k, 1,200+, 3x, 8.9 … normalised for comparison. */
export function extractNumbers(text: string): string[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, ''));
}
