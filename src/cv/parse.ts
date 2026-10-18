import type { Provider } from '../providers/types.js';
import { draftToProfile, ProfileDraft, type Profile } from '../schemas/profile.js';
import type { ExtractedCv } from './extract.js';

const SYSTEM = `You convert a student's CV (raw text extracted from a PDF or DOCX) into structured JSON.

<rules>
- Copy information faithfully. NEVER invent, embellish or infer facts, numbers, dates, links or technologies that are not in the CV.
- Keep bullet points as written. Only repair extraction artifacts: broken hyphenation, stray line breaks, merged or split words, and bullets broken across lines.
- Dates exactly as written (e.g. "Jun 2024", "2022 – 2026"). Use "Present" only if the CV says so.
- Use null for anything absent and [] for empty lists.
- Match URLs from the "Links" list to contact fields (linkedin, github, website) and to project links when the anchor clearly relates to that project.
- Project "tech": technologies the CV names for that project (from its tech line or bullets).
- Group skills into sensible categories (e.g. Languages, Frameworks & Libraries, Databases, Tools & Platforms), using only skills the CV mentions.
- Hackathon wins, ranks, competitive-programming ratings, scholarships and positions of responsibility go in "achievements".
- "score": CGPA or percentage exactly as written.
</rules>`;

export async function parseCv(provider: Provider, cv: ExtractedCv): Promise<Profile> {
  const input = [
    'CV TEXT:',
    '"""',
    cv.text,
    '"""',
    cv.links.length ? `\nLinks found in the document:\n${cv.links.map((l) => `- ${l}`).join('\n')}` : '',
  ].join('\n');
  const draft = await provider.runStructured({ system: SYSTEM, input, schema: ProfileDraft });
  return draftToProfile(draft);
}
