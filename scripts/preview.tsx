// Dev helper: render the UI kit to the terminal without running the app. `npx tsx scripts/preview.tsx`
import React from 'react';
import { Box, renderToString } from 'ink';
import fs from 'node:fs';
import { Logo, MiniLogo, StepDots, AtsPanel, Rule, Bar } from '../src/app/graphics.js';
import { scoreResume } from '../src/ats/score.js';
import { profileToResume } from '../src/latex/render.js';
const p = JSON.parse(fs.readFileSync(new URL('../test/fixtures/profile.json', import.meta.url), 'utf8'));
const r = profileToResume(p);
const kw = { required: ['Node.js', 'Express', 'REST APIs', 'PostgreSQL', 'Redis', 'Docker', 'Kafka', 'system design'], preferred: ['Kubernetes', 'GitHub Actions'] };
const before = scoreResume({ ...r, skills: [] , projects: []}, kw);
const after = scoreResume(r, kw);
const out = renderToString(
  <Box flexDirection="column">
    <Logo />
    <StepDots n={2} total={3} title="Link your GitHub" />
    <MiniLogo title="Tailor mode" />
    <AtsPanel before={before} after={after} />
    <Rule title="Projects" />
  </Box>, { columns: 80 });
console.log(out);
