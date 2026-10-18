import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execa } from 'execa';
import { toStrictJsonSchema } from '../schemas/json-schema.js';
import { DEFAULT_TIMEOUT_MS, parseJsonLoose, withValidation } from './run.js';
import type { Provider, ProviderStatus, StructuredRequest } from './types.js';
import { ProviderError } from './types.js';

export async function codexStatus(): Promise<ProviderStatus> {
  const base = { name: 'codex' as const, label: 'Codex CLI' };
  try {
    const { stdout, stderr } = await execa('codex', ['login', 'status'], { timeout: 15_000, reject: false });
    const text = `${stdout}\n${stderr}`;
    const loggedIn = !/not logged in/i.test(text) && /logged in/i.test(text);
    return loggedIn
      ? { ...base, installed: true, loggedIn: true, hint: null }
      : { ...base, installed: true, loggedIn: false, hint: 'Run `codex login` first.' };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ...base, installed: false, loggedIn: false, hint: 'Install: npm i -g @openai/codex' };
    }
    return { ...base, installed: true, loggedIn: false, hint: 'Could not check Codex login status.' };
  }
}

export function createCodexProvider(model: string | null): Provider {
  return {
    name: 'codex',
    label: 'Codex CLI',
    async runStructured<T>(req: StructuredRequest<T>): Promise<T> {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lockedin-'));
      const schemaFile = path.join(dir, 'schema.json');
      const outFile = path.join(dir, 'out.json');
      await fs.writeFile(schemaFile, JSON.stringify(toStrictJsonSchema(req.schema)));
      try {
        return await withValidation(req, async (input) => {
          await fs.rm(outFile, { force: true });
          const args = [
            'exec', '-',
            '--output-schema', schemaFile,
            '-o', outFile,
            '-s', 'read-only',
            '--skip-git-repo-check',
            '--ephemeral',
            '--color', 'never',
            '-C', dir,
          ];
          if (model) args.push('-m', model);
          // codex exec has no separate system prompt flag; prepend it.
          const proc = await execa('codex', args, {
            input: `${req.system}\n\n---\n\n${input}`,
            timeout: req.timeoutMs ?? DEFAULT_TIMEOUT_MS,
            reject: false,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          if (proc.timedOut) throw new ProviderError('Codex timed out.');
          let text: string;
          try {
            text = await fs.readFile(outFile, 'utf8');
          } catch {
            const tail = proc.stderr.split('\n').filter(Boolean).slice(-5).join('\n');
            const hint = /401|unauthorized/i.test(tail) ? 'Codex is not logged in. Run `codex login`.' : 'Codex CLI failed.';
            throw new ProviderError(hint, tail);
          }
          return parseJsonLoose(text);
        });
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    },
  };
}
