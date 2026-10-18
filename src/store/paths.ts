import os from 'node:os';
import path from 'node:path';

/** Root data dir. Override with LOCKEDIN_HOME (used by tests). */
export function homeDir(): string {
  return process.env.LOCKEDIN_HOME ?? path.join(os.homedir(), '.lockedin');
}

export const paths = {
  get config() {
    return path.join(homeDir(), 'config.json');
  },
  get profile() {
    return path.join(homeDir(), 'profile.json');
  },
  get baseTex() {
    return path.join(homeDir(), 'base.tex');
  },
  get repos() {
    return path.join(homeDir(), 'repos.json');
  },
  get outputs() {
    return path.join(homeDir(), 'outputs');
  },
};
