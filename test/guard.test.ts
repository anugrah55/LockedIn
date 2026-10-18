import { describe, expect, it } from 'vitest';
import type { TailorResult } from '../src/schemas/tailored.js';
import { Evidence, termKey } from '../src/tailor/evidence.js';
import { guardTailorResult } from '../src/tailor/guard.js';
import { buildResume } from '../src/tailor/tailor.js';
import { fixtureProfile, makeRepo } from './helpers.js';

const profile = fixtureProfile();
const repos = [
  makeRepo({
    name: 'upi-ledger',
    description: 'Double-entry ledger service for UPI payments',
    primaryLanguage: 'Go',
    languages: ['Go', 'Dockerfile'],
    topics: ['postgres', 'grpc'],
    readme: 'A ledger built with Go and gRPC, backed by Postgres. Handles 300 req/s in load tests. Deployed with Docker.',
  }),
  makeRepo({ name: 'secret-app', isPrivate: true, languages: ['TypeScript'], readme: 'Next.js dashboard' }),
];

const base: TailorResult = {
  objective: null,
  skills: [],
  projects: [],
  experience: [],
  achievementIndices: [],
};

describe('termKey / Evidence', () => {
  it('normalises common spellings', () => {
    expect(termKey('Node.js')).toBe(termKey('nodejs'));
    expect(termKey('Postgres')).toBe(termKey('PostgreSQL'));
    expect(termKey('REST APIs')).toBe(termKey('REST API'));
    expect(termKey('HTML5')).toBe(termKey('html'));
  });
  it('matches multi-word and hyphenated terms without substring false positives', () => {
    const ev = new Evidence(['Built CI with GitHub Actions and scikit-learn models in Python']);
    expect(ev.has('GitHub Actions')).toBe(true);
    expect(ev.has('scikit-learn')).toBe(true);
    expect(ev.has('sklearn')).toBe(true);
    expect(ev.has('Go')).toBe(false); // "go" is not a token here
    expect(ev.has('Kubernetes')).toBe(false);
  });
  it('ignores descriptive parentheticals and generic suffixes', () => {
    const ev = new Evidence(['Calls OpenAI and stores vectors in ChromaDB']);
    expect(ev.has('ChromaDB (Vector DB)')).toBe(true);
    expect(ev.has('OpenAI API')).toBe(true);
    expect(ev.has('Pinecone (Vector DB)')).toBe(false);
    expect(ev.has('Stripe API')).toBe(false);
  });
});

describe('concepts', () => {
  it('lets a concrete tool prove a concept only when enabled', () => {
    const text = ['Integrated Razorpay checkout with JWT login and GitHub Actions'];
    const guard = new Evidence(text, { concepts: true });
    expect(guard.has('Payment gateway integration')).toBe(true);
    expect(guard.has('Authentication')).toBe(true);
    expect(guard.has('CI/CD')).toBe(true);
    expect(guard.has('Vector database')).toBe(false);
    // ATS scoring is literal: a real ATS won't infer "payment gateway" from "Razorpay".
    expect(new Evidence(text).has('Payment gateway integration')).toBe(false);
  });
});

describe('guardTailorResult', () => {
  it('drops projects that reference nothing real', () => {
    const { result, warnings } = guardTailorResult(
      {
        ...base,
        projects: [
          { source: 'repo', ref: 'does-not-exist', name: 'Ghost', tech: ['Rust'], bullets: ['Built a thing'] },
          { source: 'profile', ref: 'proj-99', name: 'Ghost 2', tech: [], bullets: ['Built'] },
          { source: 'repo', ref: 'UPI-Ledger', name: 'UPI Ledger', tech: ['Go'], bullets: ['Built a ledger in Go'] },
        ],
      },
      profile,
      repos,
    );
    expect(result.projects.map((p) => p.name)).toEqual(['UPI Ledger']);
    expect(warnings.filter((w) => w.startsWith('Dropped project'))).toHaveLength(2);
  });

  it('removes technologies not evidenced by the project itself', () => {
    const { result, warnings } = guardTailorResult(
      {
        ...base,
        projects: [
          { source: 'repo', ref: 'upi-ledger', name: 'UPI Ledger', tech: ['Go', 'gRPC', 'PostgreSQL', 'Kubernetes', 'Redis'], bullets: ['Built a ledger'] },
        ],
      },
      profile,
      repos,
    );
    // Redis is in the CV skills but NOT in this repo — claiming it here would be a lie.
    expect(result.projects[0]!.tech).toEqual(['Go', 'gRPC', 'PostgreSQL']);
    expect(warnings.some((w) => w.includes('"Kubernetes"'))).toBe(true);
    expect(warnings.some((w) => w.includes('"Redis"'))).toBe(true);
  });

  it('drops bullets with invented numbers but keeps sourced ones', () => {
    const { result } = guardTailorResult(
      {
        ...base,
        projects: [
          {
            source: 'repo',
            ref: 'upi-ledger',
            name: 'UPI Ledger',
            tech: ['Go'],
            bullets: ['Sustained 300 req/s in load tests', 'Served 10,000 daily users'],
          },
        ],
      },
      profile,
      repos,
    );
    expect(result.projects[0]!.bullets).toEqual(['Sustained 300 req/s in load tests']);
  });

  it('keeps every experience entry and reverts to original bullets when rewrites are unverifiable', () => {
    const { result } = guardTailorResult(
      { ...base, experience: [{ ref: 'exp-1', bullets: ['Cut latency by 90%'] }, { ref: 'exp-7', bullets: ['x'] }] },
      profile,
      repos,
    );
    expect(result.experience).toEqual([{ ref: 'exp-1', bullets: profile.experience[0]!.bullets }]);
  });

  it('filters skills to the CV + GitHub corpus', () => {
    const { result } = guardTailorResult(
      {
        ...base,
        skills: [
          { category: 'Languages', items: ['Python', 'Go', 'Rust'] },
          { category: 'Infra', items: ['Kubernetes', 'Terraform'] },
        ],
      },
      profile,
      repos,
    );
    expect(result.skills).toEqual([{ category: 'Languages', items: ['Python', 'Go'] }]);
  });
});

describe('objective', () => {
  it('keeps a summary whose numbers come from education/CGPA', () => {
    const { result } = guardTailorResult(
      { ...base, objective: 'CSE undergrad (2026, CGPA 8.9/10) who built RAG apps' },
      profile,
      repos,
    );
    expect(result.objective).not.toBeNull();
  });
  it('drops a summary with invented numbers', () => {
    const { result } = guardTailorResult({ ...base, objective: 'Shipped apps used by 50000 people' }, profile, repos);
    expect(result.objective).toBeNull();
  });
});

describe('buildResume', () => {
  it('does not link private repos and falls back to the first achievements', () => {
    const { result } = guardTailorResult(
      {
        ...base,
        projects: [
          { source: 'repo', ref: 'secret-app', name: 'Secret App', tech: ['TypeScript', 'Next.js'], bullets: ['Built a Next.js dashboard'] },
          { source: 'repo', ref: 'upi-ledger', name: 'UPI Ledger', tech: ['Go'], bullets: ['Built a ledger'] },
        ],
      },
      profile,
      repos,
    );
    const resume = buildResume(profile, repos, result);
    expect(resume.projects.map((p) => p.link)).toEqual([null, 'https://github.com/priyasharma/upi-ledger']);
    expect(resume.achievements).toEqual(profile.achievements);
    expect(resume.experience[0]!.organization).toBe('Finly Labs');
  });
});
