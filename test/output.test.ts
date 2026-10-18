import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { profileToResume } from '../src/latex/render.js';
import { shrinkResume } from '../src/output/compile.js';
import { overleafHtml } from '../src/output/overleaf.js';
import { saveOutputs } from '../src/output/save.js';
import { fixtureProfile } from './helpers.js';

describe('overleafHtml', () => {
  it('posts the encoded tex to Overleaf without breaking the attribute', () => {
    const tex = '\\section{A "quoted" <tag> & 100% done}';
    const html = overleafHtml(tex);
    expect(html).toContain('action="https://www.overleaf.com/docs" method="post"');
    const value = html.match(/name="encoded_snip" value="([^"]*)"/)![1]!;
    expect(decodeURIComponent(value)).toBe(tex);
    expect(html).toContain('name="engine" value="pdflatex"');
  });
});

describe('shrinkResume', () => {
  const base = profileToResume(fixtureProfile());
  base.projects = Array.from({ length: 5 }, (_, i) => ({ ...base.projects[0]!, name: `P${i}`, bullets: ['a', 'b', 'c', 'd'] }));

  it('level 0 is a no-op copy', () => {
    const r = shrinkResume(base, 0);
    expect(r).toEqual(base);
    expect(r).not.toBe(base);
  });
  it('trims bullets before whole projects', () => {
    expect(shrinkResume(base, 1).projects.every((p) => p.bullets.length === 3)).toBe(true);
    expect(shrinkResume(base, 2).projects).toHaveLength(5);
    expect(shrinkResume(base, 3).projects).toHaveLength(3);
  });
  it('never mutates the input', () => {
    shrinkResume(base, 5);
    expect(base.projects).toHaveLength(5);
    expect(base.projects[0]!.bullets).toHaveLength(4);
  });
});

describe('saveOutputs', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lockedin-test-'));
    process.env.LOCKEDIN_HOME = dir;
  });
  afterEach(async () => {
    delete process.env.LOCKEDIN_HOME;
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('never overwrites an earlier version from the same day', async () => {
    const r = profileToResume(fixtureProfile());
    const a = await saveOutputs('backend', r, 'A', null);
    const b = await saveOutputs('backend', r, 'B', null);
    expect(a.tex).not.toBe(b.tex);
    expect(b.tex).toMatch(/backend-\d{4}-\d{2}-\d{2}-2\.tex$/);
    expect(await fs.readFile(a.tex, 'utf8')).toBe('A');
  });
});
