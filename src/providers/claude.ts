import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execa } from 'execa';
import { toStrictJsonSchema } from '../schemas/json-schema.js';
import { DEFAULT_TIMEOUT_MS, parseJsonLoose, withValidation } from './run.js';
import type { Provider, ProviderStatus, StructuredRequest } from './types.js';
import { ProviderError } from './types.js';

export async function claudeStatus(): Promise<ProviderStatus> {
  const base = { name: 'claude' as const, label: 'Claude Code' };
  try {
    const { stdout } = await execa('claude', ['auth', 'status'], { timeout: 15_000, reject: false });
    const status = JSON.parse(stdout) as { loggedIn?: boolean };
    return status.loggedIn
      ? { ...base, installed: true, loggedIn: true, hint: null }
      : { ...base, installed: true, loggedIn: false, hint: 'Run `claude` once and log in.' };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ...base, installed: false, loggedIn: false, hint: 'Install: npm i -g @anthropic-ai/claude-code' };
    }
    // Older CLIs without `auth status`: assume usable if the binary runs.
    return { ...base, installed: true, loggedIn: true, hint: null };
  }
}

interface ClaudeEnvelope {
  is_error?: boolean;
  result?: string;
  structured_output?: unknown;
}

export function createClaudeProvider(model: string | null): Provider {
  return {
    name: 'claude',
    label: 'Claude Code',
    async runStructured<T>(req: StructuredRequest<T>): Promise<T> {
      const schema = JSON.stringify(toStrictJsonSchema(req.schema));
      // Run from an empty temp dir so no project CLAUDE.md / files leak in.
      const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lockedin-'));
      try {
        return await withValidation(req, async (input) => {
          const args = [
            '-p',
            '--safe-mode', // keeps auth; drops the user's hooks, MCP servers, CLAUDE.md
            '--tools', '',
            '--no-session-persistence',
            '--output-format', 'json',
            '--system-prompt', req.system,
            '--json-schema', schema,
          ];
          if (model) args.push('--model', model);
          const proc = await execa('claude', args, {
            cwd,
            input,
            timeout: req.timeoutMs ?? DEFAULT_TIMEOUT_MS,
            reject: false,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          if (proc.timedOut) throw new ProviderError('Claude timed out.');
          let env: ClaudeEnvelope;
          try {
            env = JSON.parse(proc.stdout) as ClaudeEnvelope;
          } catch {
            throw new ProviderError('Claude CLI failed.', (proc.stderr || proc.stdout).slice(0, 1000));
          }
          if (env.is_error) throw new ProviderError('Claude returned an error.', env.result);
          return env.structured_output ?? parseJsonLoose(env.result ?? '');
        });
      } finally {
        await fs.rm(cwd, { recursive: true, force: true });
      }
    },
  };
}
