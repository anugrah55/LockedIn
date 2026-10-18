import type { Profile } from '../schemas/profile.js';
import type { Resume } from '../schemas/tailored.js';
import { displayUrl, escapeLatex as e, escapeUrl, normalizeUrl } from './escape.js';
import { JAKE_PREAMBLE } from './templates/jake.js';

const MAX_HEADING_TECH = 5;
const HEADING_CHAR_BUDGET = 95;

const href = (url: string, text: string) =>
  `\\href{${escapeUrl(normalizeUrl(url))}}{\\underline{${e(text)}}}`;

const dateRange = (start: string | null, end: string | null) =>
  [start, end].filter(Boolean).map((d) => e(d!)).join(' -- ');

function header(r: Resume): string {
  const c = r.contact;
  const parts: string[] = [];
  if (c.phone) parts.push(e(c.phone));
  if (c.email) parts.push(`\\href{mailto:${escapeUrl(c.email)}}{\\underline{${e(c.email)}}}`);
  if (c.linkedin) parts.push(href(c.linkedin, displayUrl(c.linkedin)));
  if (c.github) parts.push(href(c.github, displayUrl(c.github)));
  if (c.website) parts.push(href(c.website, displayUrl(c.website)));
  if (c.location && parts.length < 5) parts.push(e(c.location));
  return [
    '\\begin{center}',
    `    \\textbf{\\Huge \\scshape ${e(c.name)}} \\\\ \\vspace{1pt}`,
    `    \\small ${parts.join(' $|$ ')}`,
    '\\end{center}',
  ].join('\n');
}

function bullets(items: string[], indent = '      '): string {
  if (!items.length) return '';
  return [
    `${indent}\\resumeItemListStart`,
    ...items.map((b) => `${indent}  \\resumeItem{${e(b)}}`),
    `${indent}\\resumeItemListEnd`,
  ].join('\n');
}

function section(title: string, body: string): string {
  return `%-----------${title.toUpperCase()}-----------\n\\section{${title}}\n${body}\n`;
}

function summary(r: Resume): string {
  if (!r.objective) return '';
  return section(
    'Summary',
    `\\begin{itemize}[leftmargin=0.15in, label={}]\n  \\small{\\item{${e(r.objective)}}}\n\\end{itemize}`,
  );
}

function education(r: Resume): string {
  if (!r.education.length) return '';
  const items = r.education.map((ed) => {
    const degree = ed.score ? `${ed.degree}; ${ed.score}` : ed.degree;
    const lines = [
      '    \\resumeSubheading',
      `      {${e(ed.institution)}}{${e(ed.location ?? '')}}`,
      `      {${e(degree)}}{${dateRange(ed.start, ed.end)}}`,
    ];
    if (ed.coursework.length) lines.push(bullets([`**Relevant Coursework:** ${ed.coursework.join(', ')}`]));
    return lines.join('\n');
  });
  return section('Education', ['  \\resumeSubHeadingListStart', ...items, '  \\resumeSubHeadingListEnd'].join('\n'));
}

function experience(r: Resume): string {
  if (!r.experience.length) return '';
  const items = r.experience.map((x) =>
    [
      '    \\resumeSubheading',
      `      {${e(x.title)}}{${dateRange(x.start, x.end)}}`,
      `      {${e(x.organization)}}{${e(x.location ?? '')}}`,
      bullets(x.bullets),
    ]
      .filter(Boolean)
      .join('\n'),
  );
  return section('Experience', ['  \\resumeSubHeadingListStart', ...items, '  \\resumeSubHeadingListEnd'].join('\n'));
}

function linkLabel(url: string): string {
  return /github\.com/i.test(url) ? 'GitHub' : 'Live';
}

/**
 * The heading is a non-wrapping tabular cell, so a long name + tech list runs
 * past the right margin. Drop trailing (least relevant) tech until it fits.
 */
export function headingTech(name: string, tech: string[], hasLink: boolean, date: string | null): string[] {
  const fixed = name.length + (hasLink ? 9 : 0) + (date ? date.length + 2 : 0);
  let out = tech.slice(0, MAX_HEADING_TECH);
  while (out.length > 2 && fixed + 3 + out.join(', ').length > HEADING_CHAR_BUDGET) out = out.slice(0, -1);
  return out;
}

function projects(r: Resume): string {
  if (!r.projects.length) return '';
  const items = r.projects.map((p) => {
    const title = [`\\textbf{${e(p.name)}}`];
    const tech = headingTech(p.name, p.tech, !!p.link, p.date);
    if (tech.length) title.push(`\\emph{${e(tech.join(', '))}}`);
    if (p.link) title.push(href(p.link, linkLabel(p.link)));
    return [
      '    \\resumeProjectHeading',
      `      {${title.join(' $|$ ')}}{${e(p.date ?? '')}}`,
      bullets(p.bullets),
    ]
      .filter(Boolean)
      .join('\n');
  });
  return section('Projects', ['  \\resumeSubHeadingListStart', ...items, '  \\resumeSubHeadingListEnd'].join('\n'));
}

function skills(r: Resume): string {
  const groups = r.skills.filter((g) => g.items.length);
  if (!groups.length) return '';
  const lines = groups.map((g, i) => {
    const sep = i < groups.length - 1 ? ' \\\\' : '';
    return `     \\textbf{${e(g.category)}}{: ${e(g.items.join(', '))}}${sep}`;
  });
  return section(
    'Technical Skills',
    ['\\begin{itemize}[leftmargin=0.15in, label={}]', '    \\small{\\item{', ...lines, '    }}', '\\end{itemize}'].join(
      '\n',
    ),
  );
}

function simpleList(title: string, items: string[]): string {
  if (!items.length) return '';
  return section(
    title,
    [
      '\\begin{itemize}[leftmargin=0.32in, itemsep=-2pt]',
      ...items.map((a) => `  \\resumeItem{${e(a)}}`),
      '\\end{itemize}',
    ].join('\n'),
  );
}

export function renderResume(r: Resume): string {
  const body = [
    header(r),
    '',
    summary(r),
    education(r),
    experience(r),
    projects(r),
    skills(r),
    simpleList('Achievements', r.achievements),
    simpleList('Certifications', r.certifications),
  ]
    .filter((s) => s !== '')
    .join('\n');
  return `${JAKE_PREAMBLE}\n\\begin{document}\n\n${body}\n\\end{document}\n`;
}

/** The untailored resume: the profile exactly as parsed from the CV. */
export function profileToResume(p: Profile): Resume {
  return {
    contact: p.contact,
    objective: p.summary,
    education: p.education,
    experience: p.experience.map(({ id: _id, ...x }) => x),
    projects: p.projects.map(({ id: _id, ...x }) => x),
    skills: p.skills,
    achievements: p.achievements,
    certifications: p.certifications,
  };
}
