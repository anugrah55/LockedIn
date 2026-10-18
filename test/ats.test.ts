import { describe, expect, it } from 'vitest';
import { needsExtraction, roleKeywords } from '../src/ats/keywords.js';
import { scoreResume, WEIGHTS } from '../src/ats/score.js';
import { profileToResume } from '../src/latex/render.js';
import { customRole, ROLES } from '../src/tailor/roles.js';
import { fixtureProfile } from './helpers.js';

const resume = profileToResume(fixtureProfile());

describe('scoreResume', () => {
  it('weights required keywords double and reports what is missing', () => {
    const r = scoreResume(resume, { required: ['Node.js', 'Kubernetes'], preferred: ['Redis'] });
    // got: Node.js (2) + Redis (1) of 5
    expect(r.keywords.score).toBeCloseTo((3 / 5) * WEIGHTS.keywords);
    expect(r.keywords.matched).toEqual(['Node.js', 'Redis']);
    expect(r.keywords.requiredMissing).toEqual(['Kubernetes']);
  });

  it('matches spelling variants', () => {
    const r = scoreResume(resume, { required: ['NodeJS', 'Postgres', 'CI/CD'], preferred: [] });
    expect(r.keywords.missing).toEqual(['CI/CD']);
  });

  it('rewards action verbs and numbers', () => {
    const r = scoreResume(resume, { required: [], preferred: [] });
    expect(r.impact.bullets).toBe(6);
    expect(r.impact.actionVerb).toBeGreaterThanOrEqual(4);
    expect(r.impact.quantified).toBeGreaterThanOrEqual(4);
    expect(r.total).toBeGreaterThan(80);
  });

  it('flags structural problems', () => {
    const weak = {
      ...resume,
      contact: { ...resume.contact, email: null },
      experience: [{ ...resume.experience[0]!, bullets: ['I worked on my backend stuff'] }],
    };
    const r = scoreResume(weak, { required: [], preferred: [] }, { pages: 2 });
    expect(r.structure.issues).toEqual(
      expect.arrayContaining(['No email address', 'First-person pronouns in bullets', '2 pages — internships expect one']),
    );
  });

  it('tailoring with the right keywords raises the score', () => {
    const kw = { required: ['FastAPI', 'LangChain', 'RAG', 'Python'], preferred: ['ChromaDB'] };
    const before = scoreResume({ ...resume, projects: [], skills: [] }, kw);
    const after = scoreResume(resume, kw);
    expect(after.total).toBeGreaterThan(before.total);
  });
});

describe('keywords', () => {
  it('uses curated keywords for built-in roles without a JD', () => {
    const backend = ROLES.find((r) => r.id === 'backend')!;
    expect(needsExtraction({ role: backend, jobDescription: null })).toBe(false);
    expect(roleKeywords(backend).required).toHaveLength(8);
  });
  it('extracts for a JD or a custom role', () => {
    expect(needsExtraction({ role: ROLES[0]!, jobDescription: 'We need Go and Kafka' })).toBe(true);
    expect(needsExtraction({ role: customRole('SRE Intern'), jobDescription: null })).toBe(true);
  });
});

import { selectTop } from '../src/tailor/rank.js';
import { makeRepo } from './helpers.js';

describe('selectTop', () => {
  const rr = (name: string, score: number) => ({ repo: makeRepo({ name }), score, reason: '' });
  it('keeps only strong repos, up to 4', () => {
    const out = selectTop([rr('a', 90), rr('b', 70), rr('c', 55), rr('d', 36), rr('e', 30)]);
    expect(out.map((r) => r.name)).toEqual(['a', 'b', 'c']);
  });
  it('still features 2 repos when few are strong', () => {
    expect(selectTop([rr('a', 60), rr('b', 40), rr('c', 35)]).map((r) => r.name)).toEqual(['a', 'b']);
  });
});
