import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { ConversionFailedError } from '../errors.js';

export function runCommand(binary: string, args: string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(
          new ConversionFailedError(
            `${binary} exited with code ${code}`,
            stderr
          )
        );
        return;
      }
      resolvePromise();
    });
  });
}

export async function collectOutputFiles(prefix: string): Promise<string[]> {
  const abs = resolve(prefix);
  const dir = dirname(abs);
  const base = basename(abs);
  const entries = await readdir(dir);
  return entries
    .filter((f) => f.startsWith(base + '-') && f.endsWith('.png'))
    .map((f) => resolve(dir, f))
    .sort();
}
