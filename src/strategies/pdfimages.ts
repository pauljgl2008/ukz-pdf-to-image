import { resolve } from 'node:path';
import type { ConvertOptions } from '../types.js';
import { collectOutputFiles, runCommand } from './shared.js';

export async function runPdfimages(
  binary: string,
  input: string,
  options: ConvertOptions
): Promise<string[]> {
  const args = ['-png'];
  if (options.firstPage) args.push('-f', String(options.firstPage));
  if (options.lastPage) args.push('-l', String(options.lastPage));

  const outPrefix = resolve(options.output);
  args.push(input, outPrefix);

  await runCommand(binary, args);
  return collectOutputFiles(outPrefix);
}
