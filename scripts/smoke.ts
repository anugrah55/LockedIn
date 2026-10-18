/**
 * Real-CLI smoke test: one structured call per logged-in provider.
 * Usage: npm run smoke [-- claude|codex]
 */
import { z } from 'zod';
import { createProvider, detectProviders } from '../src/providers/index.js';

const Answer = z.object({
  city: z.string(),
  populationMillions: z.number().nullable(),
  facts: z.array(z.object({ text: z.string(), source: z.string().nullable() })),
});

const only = process.argv[2];
const statuses = await detectProviders();
let failed = false;
for (const s of statuses) {
  if (only && s.name !== only) continue;
  if (!s.installed || !s.loggedIn) {
    console.log(`- ${s.label}: skipped (${s.hint})`);
    continue;
  }
  const t0 = Date.now();
  try {
    const out = await createProvider({ provider: s.name, model: null }).runStructured({
      system: 'You are a precise assistant that answers with JSON matching the schema.',
      input: 'What is the capital of India? Give its metro population in millions and two short facts.',
      schema: Answer,
    });
    console.log(`✓ ${s.label} (${((Date.now() - t0) / 1000).toFixed(1)}s):`, JSON.stringify(out));
  } catch (err) {
    failed = true;
    console.log(`✗ ${s.label}:`, err instanceof Error ? `${err.message} ${(err as { detail?: string }).detail ?? ''}` : err);
  }
}
process.exit(failed ? 1 : 0);
