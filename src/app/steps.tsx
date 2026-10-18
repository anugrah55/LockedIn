import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import React, { useEffect, useState } from 'react';
import { normalizeInputPath, SUPPORTED_CV_EXTENSIONS } from '../cv/extract.js';
import { PAT_URL } from '../github/auth.js';
import { createProvider, detectProviders, type ProviderStatus } from '../providers/index.js';
import type { Profile } from '../schemas/profile.js';
import type { RepoCache } from '../schemas/repo.js';
import { loadConfig, saveConfig, type Config } from '../store/index.js';
import { getGithubToken, importCv, syncGithub } from './services.js';
import { ACCENT, Done, ErrorBox, Hint, Menu, Task, WARN } from './ui.js';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const errDetail = (e: unknown) => (e as { detail?: string })?.detail ?? null;

// ───────────────────────────── Provider ─────────────────────────────

export function ProviderStep({ onDone }: { onDone: (config: Config) => void }) {
  const [statuses, setStatuses] = useState<ProviderStatus[] | null>(null);

  const choose = async (name: ProviderStatus['name']) => {
    const config = await loadConfig();
    const next = { ...config, provider: name };
    await saveConfig(next);
    onDone(next);
  };

  useEffect(() => {
    void detectProviders().then((s) => {
      setStatuses(s);
      const usable = s.filter((p) => p.installed && p.loggedIn);
      if (usable.length === 1) void choose(usable[0]!.name);
    });
  }, []);

  if (!statuses) return <Task label="Looking for Claude Code and Codex on this machine…" />;
  const usable = statuses.filter((p) => p.installed && p.loggedIn);

  return (
    <Box flexDirection="column">
      {statuses.map((s) => (
        <Text key={s.name}>
          {s.installed && s.loggedIn ? <Text color="green">●</Text> : <Text color={WARN}>○</Text>} {s.label}
          <Text dimColor>
            {' '}
            {s.installed && s.loggedIn ? 'ready' : s.hint}
          </Text>
        </Text>
      ))}
      {usable.length === 0 ? (
        <ErrorBox
          error="LockedIn needs Claude Code or Codex installed and logged in."
          detail="Set one up using the hint above, then run `lockedin` again."
        />
      ) : usable.length > 1 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text>Which AI should write your resumes?</Text>
          <Menu items={usable.map((s) => ({ label: s.label, value: s.name }))} onSelect={(v) => void choose(v)} />
        </Box>
      ) : null}
    </Box>
  );
}

// ───────────────────────────── GitHub ─────────────────────────────

type GhPhase =
  | { k: 'resolve' }
  | { k: 'manual' }
  | { k: 'privacy'; token: string }
  | { k: 'fetch'; token: string; includePrivate: boolean }
  | { k: 'error'; message: string; token: string | null };

export function GithubStep({
  askPrivacy = true,
  onDone,
}: {
  askPrivacy?: boolean;
  onDone: (cache: RepoCache) => void;
}) {
  const [phase, setPhase] = useState<GhPhase>({ k: 'resolve' });
  const [pat, setPat] = useState('');

  const afterToken = async (token: string) => {
    if (askPrivacy) return setPhase({ k: 'privacy', token });
    const config = await loadConfig();
    setPhase({ k: 'fetch', token, includePrivate: config.includePrivate });
  };

  useEffect(() => {
    if (phase.k === 'resolve') {
      void getGithubToken().then((t) => (t ? afterToken(t) : setPhase({ k: 'manual' })));
    }
    if (phase.k === 'fetch') {
      syncGithub(phase.token, phase.includePrivate)
        .then(onDone)
        .catch((e) => setPhase({ k: 'error', message: errMsg(e), token: (e as { status?: number }).status === 401 ? null : phase.token }));
    }
  }, [phase.k]);

  switch (phase.k) {
    case 'resolve':
      return <Task label="Connecting to GitHub…" />;
    case 'manual':
      return (
        <Box flexDirection="column">
          <Text>
            Couldn't find a GitHub login (<Text color={ACCENT}>gh auth login</Text> or $GITHUB_TOKEN).
          </Text>
          <Text>
            Create a token here and paste it: <Text color={ACCENT}>{PAT_URL}</Text>
          </Text>
          <Box marginTop={1}>
            <Text>Token: </Text>
            <TextInput value={pat} onChange={setPat} mask="•" onSubmit={(v) => v.trim() && void afterToken(v.trim())} />
          </Box>
        </Box>
      );
    case 'privacy':
      return (
        <Box flexDirection="column">
          <Text>Which repositories should LockedIn look at?</Text>
          <Menu
            items={[
              { label: 'Public repos only (recommended)', value: false },
              { label: 'Include private repos — their READMEs will be sent to your AI provider', value: true },
            ]}
            onSelect={(includePrivate) => setPhase({ k: 'fetch', token: phase.token, includePrivate })}
          />
        </Box>
      );
    case 'fetch':
      return <Task label="Pulling your repositories, languages and READMEs…" />;
    case 'error':
      return (
        <Box flexDirection="column">
          <ErrorBox error={phase.message} />
          <Menu
            items={[
              { label: 'Try again', value: 'retry' as const },
              { label: 'Paste a different token', value: 'manual' as const },
            ]}
            onSelect={(v) =>
              v === 'retry' && phase.token ? void afterToken(phase.token) : setPhase({ k: 'manual' })
            }
          />
        </Box>
      );
  }
}

export function RepoSummary({ cache }: { cache: RepoCache }) {
  const pinned = cache.repos.filter((r) => r.isPinned).map((r) => r.name);
  return (
    <Done>
      GitHub <Text color={ACCENT}>@{cache.login}</Text> — {cache.repos.length} repos
      {pinned.length ? <Text dimColor> (pinned: {pinned.join(', ')})</Text> : null}
    </Done>
  );
}

// ───────────────────────────── CV ─────────────────────────────

type CvPhase =
  | { k: 'path'; error?: string }
  | { k: 'parse'; file: string }
  | { k: 'confirm'; profile: Profile; file: string };

export function CvStep({
  config,
  initialPath,
  onDone,
}: {
  config: Config;
  initialPath?: string;
  onDone: (profile: Profile) => void;
}) {
  const [phase, setPhase] = useState<CvPhase>(
    initialPath ? { k: 'parse', file: normalizeInputPath(initialPath) } : { k: 'path' },
  );
  const [input, setInput] = useState('');
  const [error, setError] = useState<{ message: string; detail: string | null } | null>(null);

  useEffect(() => {
    if (phase.k !== 'parse') return;
    setError(null);
    importCv(createProvider(config), phase.file)
      .then((profile) => setPhase({ k: 'confirm', profile, file: phase.file }))
      .catch((e) => {
        setError({ message: errMsg(e), detail: errDetail(e) });
        setPhase({ k: 'path' });
      });
  }, [phase]);

  const submitPath = (v: string) => {
    const clean = v.replace(/[\r\n]/g, '').trim();
    if (clean) setPhase({ k: 'parse', file: normalizeInputPath(clean) });
  };

  if (phase.k === 'path') {
    return (
      <Box flexDirection="column">
        {error ? <ErrorBox error={error.message} detail={error.detail} /> : null}
        <Text>Drag your CV into this window (or type its path) and press enter.</Text>
        <Text dimColor>Supported: {SUPPORTED_CV_EXTENSIONS.join(' ')}</Text>
        <Box marginTop={1}>
          <Text color={ACCENT}>❯ </Text>
          <TextInput
            value={input}
            // A pasted path can arrive with its trailing newline in the same chunk.
            onChange={(v) => (/[\r\n]/.test(v) ? submitPath(v) : setInput(v))}
            placeholder="~/Downloads/resume.pdf"
            onSubmit={submitPath}
          />
        </Box>
      </Box>
    );
  }
  if (phase.k === 'parse') {
    return (
      <Task
        label={`Reading your CV with ${config.provider === 'codex' ? 'Codex' : 'Claude'}…`}
        hint="Converting it into structured data. This usually takes 20–60s."
      />
    );
  }
  return (
    <Box flexDirection="column">
      <ProfileSummary profile={phase.profile} />
      <Box marginTop={1} flexDirection="column">
        <Text>Does this look right?</Text>
        <Menu
          items={[
            { label: 'Yes, save it', value: 'ok' as const },
            { label: 'Parse it again', value: 'retry' as const },
            { label: 'Use a different file', value: 'other' as const },
          ]}
          onSelect={(v) => {
            if (v === 'ok') onDone(phase.profile);
            else if (v === 'retry') setPhase({ k: 'parse', file: phase.file });
            else setPhase({ k: 'path' });
          }}
        />
      </Box>
      <Hint>You can always fine-tune details later in ~/.lockedin/profile.json</Hint>
    </Box>
  );
}

export function ProfileSummary({ profile: p }: { profile: Profile }) {
  const row = (label: string, value: string) => (
    <Text>
      <Text dimColor>{label.padEnd(13)}</Text>
      {value || <Text dimColor>—</Text>}
    </Text>
  );
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      <Text bold color={ACCENT}>
        {p.contact.name}
      </Text>
      {row('Contact', [p.contact.email, p.contact.phone, p.contact.location].filter(Boolean).join(' · '))}
      {row('Links', [p.contact.linkedin, p.contact.github, p.contact.website].filter(Boolean).length + ' found')}
      {row('Education', p.education.map((e) => `${e.degree} @ ${e.institution}${e.score ? ` (${e.score})` : ''}`).join('; '))}
      {row('Experience', p.experience.map((x) => `${x.title} @ ${x.organization}`).join('; '))}
      {row('Projects', p.projects.map((x) => x.name).join(', '))}
      {row('Skills', `${p.skills.reduce((n, g) => n + g.items.length, 0)} across ${p.skills.length} groups`)}
      {row('Achievements', String(p.achievements.length))}
    </Box>
  );
}
