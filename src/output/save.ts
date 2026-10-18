import fs from 'node:fs/promises';
import path from 'node:path';
import type { Resume } from '../schemas/tailored.js';
import { paths } from '../store/paths.js';

export interface SavedFiles {
  base: string;
  tex: string;
  json: string;
  pdf: string | null;
}

async function exists(p: string): Promise<boolean> {
  return fs.access(p).then(
    () => true,
    () => false,
  );
}

/** outputs/<slug>-<YYYY-MM-DD>[-n].{json,tex,pdf} — never overwrites an earlier version. */
export async function saveOutputs(slug: string, resume: Resume, tex: string, pdf: Buffer | null): Promise<SavedFiles> {
  await fs.mkdir(paths.outputs, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  let base = path.join(paths.outputs, `${slug}-${date}`);
  for (let n = 2; await exists(`${base}.tex`); n++) base = path.join(paths.outputs, `${slug}-${date}-${n}`);
  await fs.writeFile(`${base}.json`, JSON.stringify(resume, null, 2) + '\n');
  await fs.writeFile(`${base}.tex`, tex);
  if (pdf) await fs.writeFile(`${base}.pdf`, pdf);
  return { base, tex: `${base}.tex`, json: `${base}.json`, pdf: pdf ? `${base}.pdf` : null };
}
