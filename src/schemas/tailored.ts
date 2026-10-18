import { z } from 'zod';
import { Contact, Education, SkillGroup } from './profile.js';

/** LLM output of the ranking step. */
export const RankResult = z.object({
  picks: z.array(
    z.object({
      repo: z.string().describe('Exact repo name from the provided list'),
      score: z.number().describe('Relevance 0-100'),
      reason: z.string().describe('One short sentence: why this repo fits the role'),
    }),
  ),
});

/** LLM output of the tailoring step. References point back at real source material. */
export const TailorResult = z.object({
  objective: z.string().nullable(),
  skills: z.array(SkillGroup),
  projects: z.array(
    z.object({
      source: z.enum(['repo', 'profile']),
      ref: z.string().describe('Repo name (source=repo) or profile project id (source=profile)'),
      name: z.string(),
      tech: z.array(z.string()),
      bullets: z.array(z.string()),
    }),
  ),
  experience: z.array(
    z.object({
      ref: z.string().describe('Profile experience id, e.g. "exp-1"'),
      bullets: z.array(z.string()),
    }),
  ),
  achievementIndices: z.array(z.number()).describe('Indices into profile.achievements, most relevant first'),
});

/** Fully-resolved resume — the only thing the LaTeX renderer sees. */
export const Resume = z.object({
  contact: Contact,
  objective: z.string().nullable(),
  education: z.array(Education),
  experience: z.array(
    z.object({
      organization: z.string(),
      title: z.string(),
      location: z.string().nullable(),
      start: z.string().nullable(),
      end: z.string().nullable(),
      bullets: z.array(z.string()),
    }),
  ),
  projects: z.array(
    z.object({
      name: z.string(),
      tech: z.array(z.string()),
      link: z.string().nullable(),
      date: z.string().nullable(),
      bullets: z.array(z.string()),
    }),
  ),
  skills: z.array(SkillGroup),
  achievements: z.array(z.string()),
  certifications: z.array(z.string()),
});

export type RankResult = z.infer<typeof RankResult>;
export type TailorResult = z.infer<typeof TailorResult>;
export type Resume = z.infer<typeof Resume>;
