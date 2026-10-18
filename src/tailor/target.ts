import type { Role } from './roles.js';

/** What the user is applying for: a role, optionally a specific job description. */
export interface Target {
  role: Role;
  jobDescription: string | null;
}

export function describeTarget({ role, jobDescription }: Target): string {
  const lines = [`TARGET ROLE: ${role.title}`, `Role summary: ${role.description}`];
  if (role.keywords.length) lines.push(`Typical keywords: ${role.keywords.join(', ')}`);
  if (jobDescription?.trim()) {
    lines.push('', 'JOB DESCRIPTION (tailor to this specific posting):', '"""', jobDescription.trim(), '"""');
  }
  return lines.join('\n');
}
