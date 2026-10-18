import { render } from 'ink-testing-library';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { ProfileSummary } from '../src/app/steps.js';
import { TailorFlow } from '../src/app/Tailor.js';
import { MultiSelect } from '../src/app/ui.js';
import { fixtureProfile } from './helpers.js';

const tick = () => new Promise((r) => setTimeout(r, 20));
const config = { provider: 'claude' as const, model: null, includePrivate: false, githubLogin: 'priya' };

describe('TailorFlow', () => {
  it('starts with the role picker, hot roles flagged', () => {
    const { lastFrame } = render(<TailorFlow config={config} profile={fixtureProfile()} repos={[]} onExit={() => {}} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Which role are you applying for?');
    expect(frame).toContain('✦ GenAI / LLM Engineer');
    expect(frame).toContain('Custom role');
  });

  it('asks for a job description after a role is chosen', async () => {
    const { lastFrame, stdin } = render(
      <TailorFlow config={config} profile={fixtureProfile()} repos={[]} onExit={() => {}} />,
    );
    await tick();
    stdin.write('\r');
    await tick();
    expect(lastFrame()).toContain('Do you have the job description?');
    expect(lastFrame()).toContain('AI / ML Engineer');
  });

  it('arrow keys move through roles', async () => {
    const { lastFrame, stdin } = render(
      <TailorFlow config={config} profile={fixtureProfile()} repos={[]} onExit={() => {}} />,
    );
    await tick();
    stdin.write('\u001B[B');
    await tick();
    stdin.write('\u001B[B');
    await tick();
    stdin.write('\r');
    await tick();
    expect(lastFrame()).toContain('Role: Backend Engineer');
  });
});

describe('ProfileSummary', () => {
  it('shows the parsed CV at a glance', () => {
    const { lastFrame } = render(<ProfileSummary profile={fixtureProfile()} />);
    expect(lastFrame()).toContain('Priya Sharma');
    expect(lastFrame()).toContain('Backend Developer Intern @ Finly Labs');
    expect(lastFrame()).toContain('NyayaBot');
  });
});

describe('MultiSelect', () => {
  it('toggles with space and submits selected values', async () => {
    let result: string[] = [];
    const { stdin } = render(
      <MultiSelect
        items={[
          { label: 'a', value: 'a' },
          { label: 'b', value: 'b' },
        ]}
        initial={new Set([0])}
        onSubmit={(v) => (result = v)}
      />,
    );
    await tick();
    stdin.write('\u001B[B'); // down
    await tick();
    stdin.write(' ');
    await tick();
    stdin.write('\r');
    await tick();
    expect(result).toEqual(['a', 'b']);
  });
});
