import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';
import type { DetectedBinaries } from './types.js';

// On Windows, PATHEXT tells the shell which extensions are executable.
// We replicate that lookup so we don't have to execute the binary just to check.
const WIN_EXTS =
  process.platform === 'win32'
    ? (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';')
    : [''];

function findOnPath(binary: string): string | null {
  const paths = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  for (const dir of paths) {
    for (const ext of WIN_EXTS) {
      const candidate = join(dir, binary + ext);
      try {
        accessSync(candidate, constants.X_OK);
        return candidate;
      } catch {
        // not found or not executable — try next
      }
    }
  }
  return null;
}

function firstAvailable(candidates: string[]): string | null {
  for (const name of candidates) {
    const found = findOnPath(name);
    if (found) return found;
  }
  return null;
}

let cache: DetectedBinaries | null = null;

export function detectBinaries(): DetectedBinaries {
  if (cache) return cache;

  // Ghostscript ships under different executable names depending on the OS/arch.
  const gsNames =
    process.platform === 'win32' ? ['gswin64c', 'gswin32c', 'gs'] : ['gs'];

  cache = {
    pdftoppm: firstAvailable(['pdftoppm']),
    pdfimages: firstAvailable(['pdfimages']),
    ghostscript: firstAvailable(gsNames),
  };

  return cache;
}
