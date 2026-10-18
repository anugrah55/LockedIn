import { z } from 'zod';

// Every field is required; "optional" values are nullable. This keeps the
// generated JSON schema valid for OpenAI strict mode (Codex) and Claude alike.

export const Contact = z.object({
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  linkedin: z.string().nullable(),
  github: z.string().nullable(),
  website: z.string().nullable(),
});

export const Education = z.object({
  institution: z.string(),
  degree: z.string(),
  location: z.string().nullable(),
  start: z.string().nullable(),
  end: z.string().nullable(),
  score: z.string().nullable().describe('CGPA / percentage exactly as written, e.g. "8.7/10 CGPA"'),
  coursework: z.array(z.string()),
});

export const SkillGroup = z.object({
  category: z.string().describe('e.g. "Languages", "Frameworks", "Tools", "Cloud & DevOps"'),
  items: z.array(z.string()),
});

const ExperienceFields = {
  organization: z.string(),
  title: z.string(),
  location: z.string().nullable(),
  start: z.string().nullable(),
  end: z.string().nullable().describe('"Present" if ongoing'),
  bullets: z.array(z.string()),
};

const ProjectFields = {
  name: z.string(),
  tech: z.array(z.string()),
  link: z.string().nullable(),
  date: z.string().nullable(),
  bullets: z.array(z.string()),
};

/** Shape the LLM returns when parsing a CV (no ids — we assign those). */
export const ProfileDraft = z.object({
  contact: Contact,
  summary: z.string().nullable(),
  education: z.array(Education),
  experience: z.array(z.object(ExperienceFields)),
  projects: z.array(z.object(ProjectFields)),
  skills: z.array(SkillGroup),
  achievements: z.array(z.string()),
  certifications: z.array(z.string()),
});

export const Experience = z.object({ id: z.string(), ...ExperienceFields });
export const Project = z.object({ id: z.string(), ...ProjectFields });

/** Canonical stored profile (~/.lockedin/profile.json). */
export const Profile = ProfileDraft.extend({
  experience: z.array(Experience),
  projects: z.array(Project),
});

export type Contact = z.infer<typeof Contact>;
export type Education = z.infer<typeof Education>;
export type SkillGroup = z.infer<typeof SkillGroup>;
export type Experience = z.infer<typeof Experience>;
export type Project = z.infer<typeof Project>;
export type ProfileDraft = z.infer<typeof ProfileDraft>;
export type Profile = z.infer<typeof Profile>;

export function draftToProfile(draft: ProfileDraft): Profile {
  return {
    ...draft,
    experience: draft.experience.map((e, i) => ({ id: `exp-${i + 1}`, ...e })),
    projects: draft.projects.map((p, i) => ({ id: `proj-${i + 1}`, ...p })),
  };
}
