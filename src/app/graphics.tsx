import { Box, Text } from 'ink';
import React from 'react';
import type { AtsReport } from '../ats/score.js';

// Minimal terminal graphics: a lock mark, gradient text, thin bars, chips.

export const GRAD_FROM = '#a78bfa';
export const GRAD_TO = '#22d3ee';

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

export function Gradient({ children, bold }: { children: string; bold?: boolean }) {
  const chars = [...children];
  return (
    <Text bold={bold}>
      {chars.map((ch, i) => (
        <Text key={i} color={mix(GRAD_FROM, GRAD_TO, chars.length > 1 ? i / (chars.length - 1) : 0)}>
          {ch}
        </Text>
      ))}
    </Text>
  );
}

export function Logo({ tagline = 'one resume per role, built from your real work' }: { tagline?: string }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={GRAD_FROM}>{'  ╭─╮'}</Text>
      <Text>
        <Text color={GRAD_FROM}>{' ╭┴─┴╮   '}</Text>
        <Gradient bold>L O C K E D I N</Gradient>
      </Text>
      <Text>
        <Text color={mix(GRAD_FROM, GRAD_TO, 0.5)}>{' │ ● │   '}</Text>
        <Text dimColor>{tagline}</Text>
      </Text>
      <Text color={GRAD_TO}>{' ╰───╯'}</Text>
    </Box>
  );
}

/** One-line header for inner screens. */
export function MiniLogo({ title }: { title?: string }) {
  return (
    <Box marginBottom={1}>
      <Text color={GRAD_FROM}>● </Text>
      <Gradient bold>LockedIn</Gradient>
      {title ? <Text dimColor>{`  ·  ${title}`}</Text> : null}
    </Box>
  );
}

export function scoreColor(score: number): string {
  if (score >= 75) return '#4ade80';
  if (score >= 50) return '#facc15';
  return '#f87171';
}

/** Thin progress bar: ━━━━━━──── */
export function Bar({ value, max = 100, width = 20, color }: { value: number; max?: number; width?: number; color?: string }) {
  const filled = Math.max(0, Math.min(width, Math.round((value / max) * width)));
  return (
    <Text>
      <Text color={color ?? GRAD_FROM}>{'━'.repeat(filled)}</Text>
      <Text color="gray">{'─'.repeat(width - filled)}</Text>
    </Text>
  );
}

/** Step indicator: ●──●──○  Link your GitHub */
export function StepDots({ n, total, title }: { n: number; total: number; title: string }) {
  return (
    <Box marginBottom={1}>
      {Array.from({ length: total }, (_, i) => (
        <Text key={i}>
          <Text color={i < n ? GRAD_FROM : 'gray'}>{i < n - 1 ? '●' : i === n - 1 ? '◉' : '○'}</Text>
          {i < total - 1 ? <Text color={i < n - 1 ? GRAD_FROM : 'gray'}>──</Text> : null}
        </Text>
      ))}
      <Text bold>{`   ${title}`}</Text>
      <Text dimColor>{`  ${n}/${total}`}</Text>
    </Box>
  );
}

/** Section rule: ── PROJECTS ─────── */
export function Rule({ title, width = 48 }: { title: string; width?: number }) {
  const label = ` ${title.toUpperCase()} `;
  return (
    <Box marginTop={1}>
      <Text color="gray">──</Text>
      <Text color={GRAD_FROM} bold>
        {label}
      </Text>
      <Text color="gray">{'─'.repeat(Math.max(2, width - label.length - 2))}</Text>
    </Box>
  );
}

export function Chips({ items, kind }: { items: string[]; kind: 'hit' | 'miss' }) {
  if (!items.length) return null;
  return (
    <Box flexWrap="wrap" columnGap={2}>
      {items.map((k) => (
        <Text key={k} color={kind === 'hit' ? '#4ade80' : 'gray'}>
          {kind === 'hit' ? '✓' : '·'} {k}
        </Text>
      ))}
    </Box>
  );
}

/** ATS panel: before → after gauges, breakdown, keyword chips. */
export function AtsPanel({ before, after, compact }: { before?: AtsReport; after: AtsReport; compact?: boolean }) {
  const delta = before ? after.total - before.total : 0;
  const kwTotal = after.keywords.matched.length + after.keywords.missing.length;
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} alignSelf="flex-start">
      <Text>
        <Text bold>ATS score</Text>
        <Text dimColor>  how well an applicant-tracking system will rank this resume</Text>
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {before ? (
          <Text>
            <Text dimColor>{'before  '}</Text>
            <Bar value={before.total} width={24} color="gray" />
            <Text dimColor>{`  ${String(before.total).padStart(3)}`}</Text>
          </Text>
        ) : null}
        <Text>
          <Text>{before ? 'after   ' : 'score   '}</Text>
          <Bar value={after.total} width={24} color={scoreColor(after.total)} />
          <Text bold color={scoreColor(after.total)}>{`  ${String(after.total).padStart(3)}`}</Text>
          {before && delta !== 0 ? (
            <Text color={delta > 0 ? '#4ade80' : '#f87171'}>{`  ${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)}`}</Text>
          ) : null}
        </Text>
      </Box>
      {!compact ? (
        <Box flexDirection="column" marginTop={1}>
          <Text>
            <Text dimColor>{'keywords  '}</Text>
            {after.keywords.matched.length}/{kwTotal} matched
            <Text dimColor>{'   impact  '}</Text>
            {after.impact.actionVerb}/{after.impact.bullets} strong verbs · {after.impact.quantified} with numbers
          </Text>
          {after.structure.issues.length ? (
            <Text color="#facc15">{`structure  ${after.structure.issues.join(' · ')}`}</Text>
          ) : null}
          <Box marginTop={1} flexDirection="column">
            <Chips items={after.keywords.matched} kind="hit" />
            <Chips items={after.keywords.missing} kind="miss" />
          </Box>
          {after.keywords.missing.length ? (
            <Text dimColor italic>
              Missing keywords: add them only if you've genuinely used them.
            </Text>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
