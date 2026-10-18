import { z } from 'zod';
import type { Provider } from '../providers/types.js';
import type { Role } from '../tailor/roles.js';
import { describeTarget, type Target } from '../tailor/target.js';

export const KeywordSet = z.object({
  required: z.array(z.string()).describe('Must-have hard skills, tools, languages and concepts'),
  preferred: z.array(z.string()).describe('Nice-to-have / bonus skills'),
});
export type KeywordSet = z.infer<typeof KeywordSet>;

const SYSTEM = `You extract the keywords an Applicant Tracking System (ATS) would screen for.

<rules>
- Only hard skills: programming languages, frameworks, libraries, databases, cloud/devops tools, and technical concepts (e.g. "REST APIs", "system design", "CI/CD", "RAG").
- No soft skills ("communication", "team player"), no degrees, no years of experience, no company names.
- Each keyword is 1–3 words, written the way the posting spells it (e.g. "Node.js", "PostgreSQL").
- "required": what the posting says is required, or what is central to the role. At most 12.
- "preferred": bonus / nice-to-have / "good to have" items. At most 8.
- No duplicates across or within lists.
</rules>`;

/** Role keywords are curated; a JD or a custom role needs extraction. */
export function needsExtraction(target: Target): boolean {
  return !!target.jobDescription?.trim() || target.role.keywords.length === 0;
}

export function roleKeywords(role: Role): KeywordSet {
  return { required: role.keywords.slice(0, 8), preferred: role.keywords.slice(8) };
}

export async function extractKeywords(provider: Provider, target: Target): Promise<KeywordSet> {
  if (!needsExtraction(target)) return roleKeywords(target.role);
  const out = await provider.runStructured({ system: SYSTEM, input: describeTarget(target), schema: KeywordSet });
  const seen = new Set<string>();
  const dedupe = (xs: string[]) =>
    xs
      .map((x) => x.trim())
      .filter((x) => {
        const k = x.toLowerCase();
        if (!x || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  return { required: dedupe(out.required).slice(0, 12), preferred: dedupe(out.preferred).slice(0, 8) };
}
