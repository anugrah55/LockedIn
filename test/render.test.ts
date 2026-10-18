import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { headingTech, profileToResume, renderResume } from '../src/latex/render.js';
import { Profile } from '../src/schemas/profile.js';

const fixture = Profile.parse(JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/profile.json'), 'utf8')));

describe('renderResume', () => {
  const tex = renderResume(profileToResume(fixture));

  it('matches the golden file', async () => {
    await expect(tex).toMatchFileSnapshot('fixtures/profile.golden.tex');
  });

  it('has balanced braces outside of escaped ones', () => {
    const stripped = tex.replace(/\\[{}]/g, '');
    let depth = 0;
    for (const ch of stripped) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
  });

  it('escapes hostile project content', () => {
    expect(tex).toContain('C\\# \\& C++ Notes\\_\\{draft\\}');
    expect(tex).toContain('50\\% discount \\#tags');
    expect(tex).not.toContain('🚀');
  });

  it('skips empty sections', () => {
    expect(tex).not.toContain('\\section{Summary}');
    const noExp = renderResume({ ...profileToResume(fixture), experience: [] });
    expect(noExp).not.toContain('\\section{Experience}');
  });
});

describe('headingTech', () => {
  it('keeps everything when the heading is short', () => {
    expect(headingTech('NyayaBot', ['Python', 'LangChain', 'FastAPI'], true, '2025')).toEqual(['Python', 'LangChain', 'FastAPI']);
  });
  it('drops trailing tech for long names but keeps at least two', () => {
    const tech = ['TypeScript', 'Next.js', 'Node.js', 'Express', 'SQLite', 'OpenAI'];
    const out = headingTech('Receipt Parser – Vision LLM Extraction Verification', tech, true, '2025');
    expect(out.length).toBeLessThan(5);
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out).toEqual(tech.slice(0, out.length));
  });
});
