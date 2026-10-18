import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execa } from 'execa';
import { renderResume } from '../latex/render.js';
import type { Resume } from '../schemas/tailored.js';

/** Tectonic binary: $LOCKEDIN_TECTONIC, else `tectonic` on PATH. */
export async function findTectonic(): Promise<string | null> {
  const bin = process.env.LOCKEDIN_TECTONIC ?? 'tectonic';
  try {
    const { exitCode } = await execa(bin, ['--version'], { reject: false, timeout: 10_000 });
    return exitCode === 0 ? bin : null;
  } catch {
    return null;
  }
}

export interface CompileResult {
  pdf: Buffer;
  pages: number;
}

export async function compileTex(tectonic: string, tex: string): Promise<CompileResult> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lockedin-tex-'));
  try {
    await fs.writeFile(path.join(dir, 'resume.tex'), tex);
    const proc = await execa(tectonic, ['--outdir', dir, path.join(dir, 'resume.tex')], {
      reject: false,
      timeout: 180_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (proc.exitCode !== 0) {
      const errLine = `${proc.stdout}\n${proc.stderr}`.split('\n').find((l) => l.startsWith('!') || /error/i.test(l));
      throw new Error(`LaTeX compile failed: ${errLine ?? 'unknown error'}`);
    }
    const pdf = await fs.readFile(path.join(dir, 'resume.pdf'));
    return { pdf, pages: await countPages(pdf) };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

export async function countPages(pdf: Buffer): Promise<number> {
  const { getDocumentProxy } = await import('unpdf');
  const doc = await getDocumentProxy(new Uint8Array(pdf));
  return doc.numPages;
}

const cap = <T>(xs: T[], n: number) => xs.slice(0, n);

/**
 * Progressively tighter versions of a resume. Level 0 is unchanged; each level
 * trims the least valuable content first (extra bullets before whole projects).
 */
export function shrinkResume(r: Resume, level: number): Resume {
  const out: Resume = structuredClone(r);
  if (level >= 1) {
    out.projects = out.projects.map((p) => ({ ...p, bullets: cap(p.bullets, 3) }));
    out.achievements = cap(out.achievements, 4);
    out.certifications = cap(out.certifications, 3);
  }
  if (level >= 2) {
    out.projects = out.projects.map((p) => ({ ...p, bullets: cap(p.bullets, 2) }));
    out.experience = out.experience.map((x) => ({ ...x, bullets: cap(x.bullets, 3) }));
  }
  if (level >= 3) {
    out.objective = null;
    out.projects = cap(out.projects, 3);
    out.achievements = cap(out.achievements, 3);
  }
  if (level >= 4) {
    out.education = out.education.map((e) => ({ ...e, coursework: [] }));
    out.skills = out.skills.map((g) => ({ ...g, items: cap(g.items, 8) }));
    out.certifications = cap(out.certifications, 2);
  }
  if (level >= 5) {
    out.experience = out.experience.map((x) => ({ ...x, bullets: cap(x.bullets, 2) }));
    out.achievements = cap(out.achievements, 2);
  }
  return out;
}

export const MAX_SHRINK_LEVEL = 5;

export interface FitResult {
  resume: Resume;
  tex: string;
  pdf: Buffer;
  pages: number;
  level: number;
}

/** Compile, and if it spills past one page, shrink until it fits (or we run out of levels). */
export async function fitToOnePage(tectonic: string, resume: Resume): Promise<FitResult> {
  let last: FitResult | null = null;
  for (let level = 0; level <= MAX_SHRINK_LEVEL; level++) {
    const shrunk = shrinkResume(resume, level);
    const tex = renderResume(shrunk);
    const { pdf, pages } = await compileTex(tectonic, tex);
    last = { resume: shrunk, tex, pdf, pages, level };
    if (pages <= 1) break;
  }
  return last!;
}
