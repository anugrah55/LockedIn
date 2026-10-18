import { Box, Text, useApp, useInput } from 'ink';
import React, { useEffect, useState } from 'react';
import { openInOverleaf } from '../output/overleaf.js';
import type { Profile } from '../schemas/profile.js';
import type { RepoCache } from '../schemas/repo.js';
import { loadConfig, loadProfile, loadRepos, type Config } from '../store/index.js';
import { displayPath, homeDir, paths } from '../store/paths.js';
import type { Role } from '../tailor/roles.js';
import { renderResume, profileToResume } from '../latex/render.js';
import { saveBaseResume } from './services.js';
import { CvStep, GithubStep, ProfileSummary, ProviderStep, RepoSummary } from './steps.js';
import { TailorFlow } from './Tailor.js';
import { Logo } from './graphics.js';
import { ACCENT, Banner, Done, ErrorBox, Hint, Menu, Step, Task } from './ui.js';

export type Mode = 'home' | 'onboard' | 'tailor' | 'sync' | 'cv' | 'config';

export interface AppProps {
  mode: Mode;
  cvPath?: string;
  role?: Role;
  jobDescription?: string | null;
}

interface State {
  config: Config;
  profile: Profile | null;
  repos: RepoCache | null;
}

type Screen =
  | { k: 'loading' }
  | { k: 'home' }
  | { k: 'settings' }
  | { k: 'onboard'; step: 1 | 2 | 3 | 4 }
  | { k: 'tailor' }
  | { k: 'sync' }
  | { k: 'cv'; path?: string }
  | { k: 'provider' }
  | { k: 'message'; text: string; then: Screen };

const isOnboarded = (s: State) => !!(s.config.provider && s.profile && s.repos);

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

export function App(props: AppProps) {
  const { exit } = useApp();
  const [state, setState] = useState<State | null>(null);
  const [screen, setScreen] = useState<Screen>({ k: 'loading' });
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadConfig(), loadProfile(), loadRepos()])
      .then(([config, profile, repos]) => {
        const s = { config, profile, repos };
        setState(s);
        if (props.mode === 'onboard' || (!isOnboarded(s) && props.mode !== 'cv' && props.mode !== 'sync')) {
          setScreen({ k: 'onboard', step: 1 });
        } else if (props.mode === 'tailor') setScreen({ k: 'tailor' });
        else if (props.mode === 'sync') setScreen({ k: 'sync' });
        else if (props.mode === 'cv') setScreen({ k: 'cv', path: props.cvPath });
        else if (props.mode === 'config') setScreen({ k: 'settings' });
        else setScreen({ k: 'home' });
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, []);

  // Keep one input listener alive for the app's lifetime. Otherwise Ink pauses stdin
  // on spinner-only screens and can miss the first keys on the next menu.
  useInput(() => {});

  if (loadError) return <ErrorBox error="Could not read your LockedIn data." detail={loadError} />;
  if (!state || screen.k === 'loading') return <Task label="Starting…" />;

  const update = (patch: Partial<State>) => setState((s) => ({ ...s!, ...patch }));
  const home = () => (props.mode === 'home' || props.mode === 'onboard' ? setScreen({ k: 'home' }) : exit());

  switch (screen.k) {
    case 'onboard': {
      const { step } = screen;
      return (
        <Box flexDirection="column">
          <Logo />
          <Text dimColor>Let's get you set up. This takes about two minutes.</Text>
          <Text> </Text>
          {step > 1 ? <Done>AI provider: {state.config.provider === 'codex' ? 'Codex CLI' : 'Claude Code'}</Done> : null}
          {step > 2 && state.repos ? <RepoSummary cache={state.repos} /> : null}
          {step > 3 && state.profile ? <Done>CV imported for {state.profile.contact.name}</Done> : null}
          <Box marginTop={1} flexDirection="column">
            {step === 1 ? (
              <>
                <Step n={1} total={3} title="Connect your AI" />
                <ProviderStep
                  onDone={(config) => {
                    update({ config });
                    setScreen({ k: 'onboard', step: 2 });
                  }}
                />
              </>
            ) : step === 2 ? (
              <>
                <Step n={2} total={3} title="Link your GitHub" />
                <GithubStep
                  onDone={async (repos) => {
                    update({ repos, config: await loadConfig() });
                    setScreen({ k: 'onboard', step: 3 });
                  }}
                />
              </>
            ) : step === 3 ? (
              <>
                <Step n={3} total={3} title="Upload your CV" />
                <CvStep
                  config={state.config}
                  onDone={async (profile) => {
                    await saveBaseResume(profile);
                    update({ profile });
                    setScreen({ k: 'onboard', step: 4 });
                  }}
                />
              </>
            ) : (
              <Box flexDirection="column">
                <Done>
                  Base resume saved as LaTeX: <Text dimColor>{displayPath(paths.baseTex)}</Text>
                </Done>
                <Box marginTop={1}>
                  <Text bold color={ACCENT}>
                    You're locked in.
                  </Text>
                </Box>
                <Box marginTop={1}>
                  <Menu
                    items={[
                      { label: 'Tailor my resume for a role', value: 'tailor' as const },
                      { label: 'Open my base resume in Overleaf', value: 'overleaf' as const },
                      { label: 'Go to home', value: 'home' as const },
                    ]}
                    onSelect={(v) => {
                      if (v === 'tailor') setScreen({ k: 'tailor' });
                      else if (v === 'overleaf') void openBase(state.profile!).then(() => setScreen({ k: 'home' }));
                      else setScreen({ k: 'home' });
                    }}
                  />
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      );
    }

    case 'home':
      return (
        <Box flexDirection="column">
          <Banner />
          <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} alignSelf="flex-start">
            <Text>
              <Text dimColor>{'you      '}</Text>
              <Text bold>{state.profile?.contact.name}</Text>
            </Text>
            <Text>
              <Text dimColor>{'ai       '}</Text>
              {state.config.provider === 'codex' ? 'Codex CLI' : 'Claude Code'}
            </Text>
            <Text>
              <Text dimColor>{'github   '}</Text>@{state.repos?.login}
              <Text dimColor>{`  ${state.repos?.repos.length} repos · synced ${state.repos ? ago(state.repos.fetchedAt) : 'never'}`}</Text>
            </Text>
          </Box>
          <Box marginTop={1}>
            <Menu
              items={[
                { label: '◎  Tailor my resume for a role', value: 'tailor' as const },
                { label: '⟳  Re-sync GitHub projects', value: 'sync' as const },
                { label: '▤  Import an updated CV', value: 'cv' as const },
                { label: '↗  Open base resume in Overleaf', value: 'overleaf' as const },
                { label: '⚙  Settings', value: 'settings' as const },
                { label: '×  Quit', value: 'quit' as const },
              ]}
              onSelect={(v) => {
                if (v === 'tailor') setScreen({ k: 'tailor' });
                else if (v === 'sync') setScreen({ k: 'sync' });
                else if (v === 'cv') setScreen({ k: 'cv' });
                else if (v === 'overleaf')
                  void openBase(state.profile!).then(() =>
                    setScreen({ k: 'message', text: 'Opened Overleaf in your browser.', then: { k: 'home' } }),
                  );
                else if (v === 'settings') setScreen({ k: 'settings' });
                else exit();
              }}
            />
          </Box>
        </Box>
      );

    case 'settings':
      return (
        <Box flexDirection="column">
          <Banner subtitle="Settings" />
          <Text>
            <Text dimColor>Provider       </Text>
            {state.config.provider ?? '—'}
          </Text>
          <Text>
            <Text dimColor>Private repos  </Text>
            {state.config.includePrivate ? 'included' : 'excluded'}
          </Text>
          <Text>
            <Text dimColor>Data folder    </Text>
            {displayPath(homeDir())}
          </Text>
          <Box marginTop={1}>
            <Menu
              items={[
                { label: 'Switch AI provider', value: 'provider' as const },
                { label: 'Change repo privacy & re-sync', value: 'privacy' as const },
                { label: 'Back', value: 'back' as const },
              ]}
              onSelect={(v) => {
                if (v === 'provider') setScreen({ k: 'provider' });
                else if (v === 'privacy') setScreen({ k: 'sync' });
                else home();
              }}
            />
          </Box>
        </Box>
      );

    case 'provider':
      return (
        <Box flexDirection="column">
          <Banner subtitle="Switch AI provider" />
          <ProviderStep
            onDone={(config) => {
              update({ config });
              setScreen({ k: 'message', text: `Now using ${config.provider}.`, then: { k: 'settings' } });
            }}
          />
        </Box>
      );

    case 'sync':
      return (
        <Box flexDirection="column">
          <Banner subtitle="Sync GitHub" />
          <GithubStep
            askPrivacy={props.mode !== 'sync'}
            onDone={async (repos) => {
              update({ repos, config: await loadConfig() });
              setScreen({ k: 'message', text: `Synced ${repos.repos.length} repos from @${repos.login}.`, then: { k: 'home' } });
            }}
          />
        </Box>
      );

    case 'cv':
      if (!state.config.provider) {
        return <ErrorBox error="No AI provider configured yet." detail="Run `lockedin` first to finish setup." />;
      }
      return (
        <Box flexDirection="column">
          <Banner subtitle="Import CV" />
          <CvStep
            config={state.config}
            initialPath={screen.path}
            onDone={async (profile) => {
              await saveBaseResume(profile);
              update({ profile });
              setScreen({ k: 'message', text: `Saved profile and ${displayPath(paths.baseTex)}`, then: { k: 'home' } });
            }}
          />
        </Box>
      );

    case 'tailor':
      if (!state.profile) return <ErrorBox error="No CV imported yet." detail="Run `lockedin` to finish setup." />;
      return (
        <Box flexDirection="column">
          <Banner subtitle="Tailor mode" />
          <TailorFlow
            config={state.config}
            profile={state.profile}
            repos={state.repos?.repos ?? []}
            initialRole={props.role}
            initialJd={props.jobDescription}
            onExit={home}
          />
        </Box>
      );

    case 'message':
      // One-shot commands (`lockedin sync`, `lockedin cv`) exit after their message.
      return (
        <Message
          text={screen.text}
          onContinue={() => (props.mode === 'sync' || props.mode === 'cv' ? exit() : setScreen(screen.then))}
        />
      );
  }
}

function Message({ text, onContinue }: { text: string; onContinue: () => void }) {
  return (
    <Box flexDirection="column">
      <Done>{text}</Done>
      <Box marginTop={1}>
        <Menu items={[{ label: 'Continue', value: 'ok' }]} onSelect={onContinue} />
      </Box>
      <Hint>press enter</Hint>
    </Box>
  );
}

async function openBase(profile: Profile) {
  await openInOverleaf(renderResume(profileToResume(profile)), 'resume.tex');
}

export { ProfileSummary };
