import { Box, Text, useInput, usePaste } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import React, { useEffect, useState } from 'react';

export const ACCENT = '#a78bfa';
export const OK = '#4ade80';
export const WARN = '#facc15';
export const ERR = '#f87171';

export function Banner({ subtitle }: { subtitle?: string }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text>
        <Text color={ACCENT} bold>
          ▌LockedIn
        </Text>
        <Text dimColor> — one resume per role, built from your real work</Text>
      </Text>
      {subtitle ? <Text dimColor>{subtitle}</Text> : null}
    </Box>
  );
}

export function Step({ n, total, title }: { n: number; total: number; title: string }) {
  return (
    <Box marginBottom={1}>
      <Text color={ACCENT} bold>
        [{n}/{total}]{' '}
      </Text>
      <Text bold>{title}</Text>
    </Box>
  );
}

/** Spinner with an elapsed-seconds counter — LLM calls can take a minute. */
export function Task({ label, hint }: { label: string; hint?: string }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <Box flexDirection="column">
      <Text>
        <Text color={ACCENT}>
          <Spinner type="dots" />
        </Text>{' '}
        {label} <Text dimColor>{secs}s</Text>
      </Text>
      {hint ? <Text dimColor>  {hint}</Text> : null}
    </Box>
  );
}

export function Done({ children }: { children: React.ReactNode }) {
  return (
    <Text>
      <Text color={OK}>✔</Text> {children}
    </Text>
  );
}

export function ErrorBox({ error, detail }: { error: string; detail?: string | null }) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={ERR} paddingX={1} marginY={1}>
      <Text color={ERR} bold>
        ✖ {error}
      </Text>
      {detail ? <Text dimColor>{detail.slice(0, 600)}</Text> : null}
    </Box>
  );
}

export function Hint({ children }: { children: React.ReactNode }) {
  return (
    <Box marginTop={1}>
      <Text dimColor>{children}</Text>
    </Box>
  );
}

export interface MenuItem<V> {
  label: string;
  value: V;
  key?: string;
}

export function Menu<V>({ items, onSelect, limit }: { items: MenuItem<V>[]; onSelect: (v: V) => void; limit?: number }) {
  return (
    <SelectInput
      items={items.map((i, idx) => ({ ...i, key: i.key ?? String(idx) }))}
      limit={limit}
      onSelect={(i) => onSelect(i.value)}
      indicatorComponent={({ isSelected }) => <Text color={ACCENT}>{isSelected ? '❯ ' : '  '}</Text>}
      itemComponent={({ isSelected, label }) => (
        <Text color={isSelected ? ACCENT : undefined} bold={isSelected}>
          {label}
        </Text>
      )}
    />
  );
}

/** Checkbox list: ↑/↓ move, space toggles, enter confirms. */
export function MultiSelect<V>({
  items,
  initial,
  onSubmit,
  max,
}: {
  items: MenuItem<V>[];
  initial: Set<number>;
  onSubmit: (values: V[]) => void;
  max?: number;
}) {
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState(initial);
  const window = 10;
  const start = Math.max(0, Math.min(cursor - Math.floor(window / 2), items.length - window));
  useInput((input, key) => {
    if (key.upArrow) setCursor((c) => (c - 1 + items.length) % items.length);
    else if (key.downArrow) setCursor((c) => (c + 1) % items.length);
    else if (input === ' ') {
      setSelected((s) => {
        const next = new Set(s);
        if (next.has(cursor)) next.delete(cursor);
        else if (!max || next.size < max) next.add(cursor);
        return next;
      });
    } else if (key.return && selected.size) {
      onSubmit([...selected].sort((a, b) => a - b).map((i) => items[i]!.value));
    }
  });
  return (
    <Box flexDirection="column">
      {items.slice(start, start + window).map((item, i) => {
        const idx = start + i;
        const on = selected.has(idx);
        return (
          <Text key={idx} color={idx === cursor ? ACCENT : undefined}>
            {idx === cursor ? '❯ ' : '  '}
            <Text color={on ? OK : 'gray'}>{on ? '◉' : '◯'}</Text> {item.label}
          </Text>
        );
      })}
      <Hint>
        space toggle · enter confirm · {selected.size}
        {max ? `/${max}` : ''} selected
      </Hint>
    </Box>
  );
}

/** Multi-line text box for pasting a job description. Ctrl+D submits, Esc cancels. */
export function MultilineInput({ onSubmit, onCancel }: { onSubmit: (text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState('');
  usePaste((pasted) => setText((t) => t + pasted.replace(/\r\n?/g, '\n')));
  useInput((input, key) => {
    if (key.ctrl && input === 'd') {
      if (text.trim()) onSubmit(text.trim());
    } else if (key.escape) onCancel();
    else if (key.return) setText((t) => t + '\n');
    else if (key.backspace || key.delete) setText((t) => t.slice(0, -1));
    else if (input && !key.ctrl && !key.meta) setText((t) => t + input.replace(/\r\n?/g, '\n'));
  });
  const lines = text.split('\n');
  const shown = lines.slice(-8);
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} minHeight={5}>
        {text ? (
          <>
            {lines.length > 8 ? <Text dimColor>… {lines.length - 8} more lines above</Text> : null}
            {shown.map((l, i) => (
              <Text key={i} wrap="truncate-end">
                {l || ' '}
              </Text>
            ))}
          </>
        ) : (
          <Text dimColor>Paste the job description here…</Text>
        )}
      </Box>
      <Hint>
        ctrl+d done · esc skip · {text.length} chars
      </Hint>
    </Box>
  );
}
