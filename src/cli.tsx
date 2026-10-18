import fs from 'node:fs/promises';
import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import pkg from '../package.json' with { type: 'json' };
import { App, type AppProps } from './app/App.js';
import { normalizeInputPath } from './cv/extract.js';
import { homeDir } from './store/paths.js';
import { customRole, ROLES } from './tailor/roles.js';

async function run(props: AppProps) {
  if (!process.stdin.isTTY) {
    console.error('LockedIn is interactive — please run it in a terminal.');
    process.exit(1);
  }
  const app = render(<App {...props} />);
  await app.waitUntilExit();
}

const program = new Command()
  .name('lockedin')
  .description('Tailor your resume to every internship role using your GitHub projects and your Claude/Codex CLI.')
  .version(pkg.version)
  .action(() => run({ mode: 'home' }));

program
  .command('init')
  .description('run setup again: AI provider, GitHub, CV')
  .action(() => run({ mode: 'onboard' }));

program
  .command('tailor')
  .description('build a resume tailored to a role (and optionally a job description)')
  .option('-r, --role <role>', `role id (${ROLES.map((r) => r.id).join(', ')}) or a custom title`)
  .option('--jd <file>', 'file containing the job description')
  .action(async (opts: { role?: string; jd?: string }) => {
    const role = opts.role ? (ROLES.find((r) => r.id === opts.role) ?? customRole(opts.role)) : undefined;
    const jobDescription = opts.jd ? (await fs.readFile(normalizeInputPath(opts.jd), 'utf8')).trim() : undefined;
    await run({ mode: 'tailor', role, jobDescription });
  });

program
  .command('sync')
  .description('re-fetch your GitHub repositories')
  .action(() => run({ mode: 'sync' }));

program
  .command('cv [path]')
  .description('import (or re-import) your CV — PDF, DOCX, TXT, MD or TEX')
  .action((path?: string) => run({ mode: 'cv', cvPath: path }));

program
  .command('config')
  .description('switch AI provider or repo privacy')
  .action(() => run({ mode: 'config' }));

program
  .command('roles')
  .description('list the built-in internship roles')
  .action(() => {
    for (const r of ROLES) console.log(`${r.hot ? '✦' : ' '} ${r.id.padEnd(14)} ${r.title}`);
  });

program
  .command('where')
  .description('print where LockedIn keeps your data')
  .action(() => console.log(homeDir()));

await program.parseAsync();
