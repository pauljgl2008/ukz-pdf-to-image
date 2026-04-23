import { resolve } from 'node:path';
import type { ConvertOptions } from '../types.js';
import { collectOutputFiles, runCommand } from './shared.js';

export async function runGhostscript(
  binary: string,
  input: string,
  options: ConvertOptions & { dpi: number }
): Promise<string[]> {
  const outPrefix = resolve(options.output);
  const args = [
    '-dNOPAUSE',
    '-dBATCH',
    '-dSAFER',
    '-sDEVICE=png16m',
    `-r${options.dpi}`,
  ];
  if (options.firstPage) args.push(`-dFirstPage=${options.firstPage}`);
  if (options.lastPage) args.push(`-dLastPage=${options.lastPage}`);
  args.push(`-sOutputFile=${outPrefix}-%d.png`, input);

  await runCommand(binary, args);
  return collectOutputFiles(outPrefix);
}
