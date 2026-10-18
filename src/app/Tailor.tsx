import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import open from 'open';
import React, { useEffect, useState } from 'react';
import { openInOverleaf } from '../output/overleaf.js';
import { createProvider } from '../providers/index.js';
import type { Profile } from '../schemas/profile.js';
import type { Repo } from '../schemas/repo.js';
import type { Config } from '../store/index.js';
import type { RankedRepo } from '../tailor/rank.js';
import { customRole, ROLES, type Role } from '../tailor/roles.js';
import type { Target } from '../tailor/target.js';
import { finalize, MAX_RANKED, rank, tailor, type Finalized, type TailorDraft } from './services.js';
import { ACCENT, Done, ErrorBox, Hint, Menu, MultilineInput, MultiSelect, OK, Task, WARN } from './ui.js';

type Phase =
  | { k: 'role' }
  | { k: 'custom-role' }
  | { k: 'jd-choice'; role: Role }
  | { k: 'jd'; role: Role }
  | { k: 'rank'; target: Target }
  | { k: 'tailor'; target: Target; ranked: RankedRepo[]; selected: Repo[] }
  | { k: 'review'; target: Target; ranked: RankedRepo[]; draft: TailorDraft }
  | { k: 'pick'; target: Target; ranked: RankedRepo[]; current: Repo[] }
  | { k: 'finalize'; target: Target; draft: TailorDraft }
  | { k: 'done'; target: Target; result: Finalized; message?: string }
  | { k: 'error'; message: string; detail: string | null; retry: Phase; back: Phase };

export interface TailorProps {
  config: Config;
  profile: Profile;
  repos: Repo[];
  initialRole?: Role;
  initialJd?: string | null;
  onExit: () => void;
}

export function TailorFlow({ config, profile, repos, initialRole, initialJd, onExit }: TailorProps) {
  const [phase, setPhase] = useState<Phase>(() => {
    if (initialRole && initialJd !== undefined) return { k: 'rank', target: { role: initialRole, jobDescription: initialJd } };
    if (initialRole) return { k: 'jd-choice', role: initialRole };
    return { k: 'role' };
  });
  const [customTitle, setCustomTitle] = useState('');
  const provider = createProvider(config);
  const aiName = config.provider === 'codex' ? 'Codex' : 'Claude';

  const fail = (e: unknown, retry: Phase, back: Phase) =>
    setPhase({
      k: 'error',
      message: e instanceof Error ? e.message : String(e),
      detail: (e as { detail?: string })?.detail ?? null,
      retry,
      back,
    });

  useEffect(() => {
    if (phase.k === 'rank') {
      const { target } = phase;
      if (!repos.length) {
        setPhase({ k: 'tailor', target, ranked: [], selected: [] });
        return;
      }
      rank(provider, target, repos)
        .then((ranked) =>
          setPhase({ k: 'tailor', target, ranked, selected: ranked.slice(0, MAX_RANKED).map((r) => r.repo) }),
        )
        .catch((e) => fail(e, phase, { k: 'role' }));
    }
    if (phase.k === 'tailor') {
      const { target, ranked, selected } = phase;
      tailor(provider, target, profile, selected)
        .then((draft) => setPhase({ k: 'review', target, ranked, draft }))
        .catch((e) => fail(e, phase, { k: 'role' }));
    }
    if (phase.k === 'finalize') {
      const { target, draft } = phase;
      finalize(target, draft.resume)
        .then((result) => setPhase({ k: 'done', target, result }))
        .catch((e) => fail(e, phase, { k: 'review', target, ranked: [], draft }));
    }
  }, [phase]);

  switch (phase.k) {
    case 'role':
      return (
        <Box flexDirection="column">
          <Text bold>Which role are you applying for?</Text>
          <Text dimColor>🔥 = hot right now for CS interns</Text>
          <Box marginTop={1}>
            <Menu
              limit={14}
              items={[
                ...ROLES.map((r) => ({ label: `${r.hot ? '🔥 ' : '   '}${r.title}`, value: r as Role | null })),
                { label: '   ✎ Custom role…', value: null },
              ]}
              onSelect={(r) => setPhase(r ? { k: 'jd-choice', role: r } : { k: 'custom-role' })}
            />
          </Box>
        </Box>
      );

    case 'custom-role':
      return (
        <Box flexDirection="column">
          <Text bold>Type the role title</Text>
          <Box>
            <Text color={ACCENT}>❯ </Text>
            <TextInput
              value={customTitle}
              onChange={setCustomTitle}
              placeholder="e.g. Site Reliability Engineer Intern"
              onSubmit={(v) => v.trim() && setPhase({ k: 'jd-choice', role: customRole(v.trim()) })}
            />
          </Box>
        </Box>
      );

    case 'jd-choice':
      return (
        <Box flexDirection="column">
          <Text>
            Role: <Text color={ACCENT}>{phase.role.title}</Text>
          </Text>
          <Text bold>Do you have the job description?</Text>
          <Text dimColor>Pasting it lets LockedIn mirror the exact keywords recruiters and ATS filters look for.</Text>
          <Box marginTop={1}>
            <Menu
              items={[
                { label: 'Yes — paste it', value: true },
                { label: 'No — tailor for the role in general', value: false },
              ]}
              onSelect={(yes) =>
                setPhase(yes ? { k: 'jd', role: phase.role } : { k: 'rank', target: { role: phase.role, jobDescription: null } })
              }
            />
          </Box>
        </Box>
      );

    case 'jd':
      return (
        <Box flexDirection="column">
          <Text bold>Paste the job description</Text>
          <MultilineInput
            onSubmit={(jd) => setPhase({ k: 'rank', target: { role: phase.role, jobDescription: jd } })}
            onCancel={() => setPhase({ k: 'rank', target: { role: phase.role, jobDescription: null } })}
          />
        </Box>
      );

    case 'rank':
      return (
        <Task
          label={`${aiName} is ranking your ${repos.length} repos for ${phase.target.role.title}…`}
          hint="Reading READMEs, languages and topics to find your strongest proof of fit."
        />
      );

    case 'tailor':
      return (
        <Box flexDirection="column">
          <RankList ranked={phase.ranked} selected={phase.selected} />
          <Task
            label={`${aiName} is tailoring your resume…`}
            hint="Rewriting bullets around the role. It only rewords what you've actually done."
          />
        </Box>
      );

    case 'review':
      return <Review phase={phase} onAction={setPhase} onExit={onExit} />;

    case 'pick': {
      const order = [
        ...phase.ranked.map((r) => r.repo),
        ...repos.filter((r) => !phase.ranked.some((x) => x.repo.name === r.name)),
      ];
      const scoreOf = new Map(phase.ranked.map((r) => [r.repo.name, r.score]));
      const initial = new Set(order.flatMap((r, i) => (phase.current.some((c) => c.name === r.name) ? [i] : [])));
      return (
        <Box flexDirection="column">
          <Text bold>Choose the repos to feature (up to 5)</Text>
          <MultiSelect
            max={5}
            initial={initial}
            items={order.map((r) => ({
              label: `${r.name}${scoreOf.has(r.name) ? `  ${scoreOf.get(r.name)}%` : ''}  ${r.primaryLanguage ?? ''}`,
              value: r,
            }))}
            onSubmit={(selected) => setPhase({ k: 'tailor', target: phase.target, ranked: phase.ranked, selected })}
          />
        </Box>
      );
    }

    case 'finalize':
      return <Task label="Rendering LaTeX and fitting it to one page…" />;

    case 'done':
      return <DoneScreen phase={phase} onAction={setPhase} onExit={onExit} />;

    case 'error':
      return (
        <Box flexDirection="column">
          <ErrorBox error={phase.message} detail={phase.detail} />
          <Menu
            items={[
              { label: 'Try again', value: 'retry' as const },
              { label: 'Go back', value: 'back' as const },
              { label: 'Exit', value: 'exit' as const },
            ]}
            onSelect={(v) => (v === 'retry' ? setPhase(phase.retry) : v === 'back' ? setPhase(phase.back) : onExit())}
          />
        </Box>
      );
  }
}

function RankList({ ranked, selected }: { ranked: RankedRepo[]; selected: Repo[] }) {
  if (!ranked.length) return null;
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Done>Best matches from your GitHub:</Done>
      {ranked.slice(0, 6).map((r) => {
        const on = selected.some((s) => s.name === r.repo.name);
        return (
          <Text key={r.repo.name}>
            {'  '}
            <Text color={on ? OK : 'gray'}>{on ? '◉' : '◯'}</Text> <Text bold={on}>{r.repo.name}</Text>{' '}
            <Text color={ACCENT}>{r.score}%</Text> <Text dimColor>{r.reason}</Text>
          </Text>
        );
      })}
    </Box>
  );
}

function Review({
  phase,
  onAction,
  onExit,
}: {
  phase: Extract<Phase, { k: 'review' }>;
  onAction: (p: Phase) => void;
  onExit: () => void;
}) {
  const { target, ranked, draft } = phase;
  const r = draft.resume;
  const [showAllWarnings, setShowAllWarnings] = useState(false);
  const warnings = showAllWarnings ? draft.warnings : draft.warnings.slice(0, 4);
  return (
    <Box flexDirection="column">
      <Text bold>
        Tailored for <Text color={ACCENT}>{target.role.title}</Text>
        {target.jobDescription ? <Text dimColor> · matched to your job description</Text> : null}
      </Text>

      {r.objective ? (
        <Box marginTop={1}>
          <Text italic>{r.objective}</Text>
        </Box>
      ) : null}

      <Section title="Projects">
        {r.projects.map((p, idx) => {
          const ref = draft.projectRefs[idx]?.toLowerCase();
          const reason = ranked.find((x) => x.repo.name.toLowerCase() === ref)?.reason;
          return (
            <Box key={p.name} flexDirection="column" marginBottom={1}>
              <Text>
                <Text bold>{p.name}</Text> <Text dimColor>{p.tech.join(', ')}</Text>
              </Text>
              {reason ? <Text color="gray">  ↳ {reason}</Text> : null}
              {p.bullets.map((b, i) => (
                <Text key={i}>  • {b.replace(/\*\*/g, '')}</Text>
              ))}
            </Box>
          );
        })}
      </Section>

      {r.experience.length ? (
        <Section title="Experience">
          {r.experience.map((x) => (
            <Box key={x.organization + x.title} flexDirection="column" marginBottom={1}>
              <Text bold>
                {x.title} <Text dimColor>@ {x.organization}</Text>
              </Text>
              {x.bullets.map((b, i) => (
                <Text key={i}>  • {b.replace(/\*\*/g, '')}</Text>
              ))}
            </Box>
          ))}
        </Section>
      ) : null}

      <Section title="Skills">
        {r.skills.map((g) => (
          <Text key={g.category}>
            <Text bold>{g.category}:</Text> {g.items.join(', ')}
          </Text>
        ))}
      </Section>

      {draft.warnings.length ? (
        <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor={WARN} paddingX={1}>
          <Text color={WARN} bold>
            🛡 Truth guard removed {draft.warnings.length} unverifiable item{draft.warnings.length > 1 ? 's' : ''}
          </Text>
          {warnings.map((w, i) => (
            <Text key={i} dimColor wrap="truncate-end">
              - {w}
            </Text>
          ))}
        </Box>
      ) : null}

      <Box marginTop={1}>
        <Menu
          items={[
            { label: '✔ Looks good — save it', value: 'accept' as const },
            { label: '⇄ Choose different projects', value: 'pick' as const },
            { label: '↻ Regenerate', value: 'regen' as const },
            ...(draft.warnings.length > 4 && !showAllWarnings
              ? [{ label: '… Show all guard notes', value: 'warnings' as const }]
              : []),
            { label: '✖ Discard', value: 'exit' as const },
          ]}
          onSelect={(v) => {
            if (v === 'accept') onAction({ k: 'finalize', target, draft });
            else if (v === 'pick') onAction({ k: 'pick', target, ranked, current: draft.repos });
            else if (v === 'regen') onAction({ k: 'tailor', target, ranked, selected: draft.repos });
            else if (v === 'warnings') setShowAllWarnings(true);
            else onExit();
          }}
        />
      </Box>
    </Box>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={ACCENT} bold>
        {title.toUpperCase()}
      </Text>
      {children}
    </Box>
  );
}

function DoneScreen({
  phase,
  onAction,
  onExit,
}: {
  phase: Extract<Phase, { k: 'done' }>;
  onAction: (p: Phase) => void;
  onExit: () => void;
}) {
  const { result, target } = phase;
  return (
    <Box flexDirection="column">
      <Done>
        Resume for <Text color={ACCENT}>{target.role.title}</Text> saved
      </Done>
      <Text dimColor>  {result.files.tex}</Text>
      {result.files.pdf ? (
        <>
          <Done>
            PDF compiled — {result.pages} page{result.pages === 1 ? '' : 's'}
            {result.shrinkLevel ? <Text dimColor> (trimmed to fit, level {result.shrinkLevel})</Text> : null}
          </Done>
          <Text dimColor>  {result.files.pdf}</Text>
        </>
      ) : (
        <Text dimColor>
          {result.compileError
            ? `  Local PDF build failed (${result.compileError}). Overleaf will still work.`
            : '  Tip: `brew install tectonic` to also build the PDF locally.'}
        </Text>
      )}
      {phase.message ? <Text color={OK}>{phase.message}</Text> : null}
      <Box marginTop={1}>
        <Menu
          items={[
            { label: 'Open in Overleaf', value: 'overleaf' as const },
            ...(result.files.pdf ? [{ label: 'Open PDF', value: 'pdf' as const }] : []),
            { label: 'Tailor for another role', value: 'again' as const },
            { label: 'Exit', value: 'exit' as const },
          ]}
          onSelect={(v) => {
            if (v === 'overleaf')
              void openInOverleaf(result.tex, `${target.role.title.replace(/[^\w]+/g, '_')}.tex`).then(() =>
                onAction({ ...phase, message: 'Opened Overleaf in your browser.' }),
              );
            else if (v === 'pdf') void open(result.files.pdf!);
            else if (v === 'again') onAction({ k: 'role' });
            else onExit();
          }}
        />
      </Box>
      <Hint>All versions live in ~/.lockedin/outputs</Hint>
    </Box>
  );
}
