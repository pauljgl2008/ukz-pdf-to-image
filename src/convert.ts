import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { detectBinaries } from './detect.js';
import { NoBinaryAvailableError, PdfToImageError } from './errors.js';
import { optimizePngToPalette } from './optimize.js';
import { runGhostscript } from './strategies/ghostscript.js';
import { runPdfimages } from './strategies/pdfimages.js';
import { runPdfjs } from './strategies/pdfjs.js';
import { runPdftoppm } from './strategies/pdftoppm.js';
import type { ConvertOptions, ConvertResult, Strategy } from './types.js';

const VALID_STRATEGIES: readonly Strategy[] = [
  'pdfjs',
  'pdftoppm',
  'pdfimages',
  'ghostscript',
];
const VALID_MODES = ['raster', 'extract'] as const;
const MIN_DPI = 36;
const MAX_DPI = 4800;

export async function convert(
  input: string,
  options: ConvertOptions
): Promise<ConvertResult> {
  const validated = validateOptions(options);

  await mkdir(dirname(resolve(validated.output)), { recursive: true });

  const bins = detectBinaries();

  const result = validated.strategy
    ? await runForced(validated.strategy, input, validated, bins)
    : await runAuto(validated.mode, input, validated, bins);

  if (validated.optimize) {
    await Promise.all(result.files.map(optimizePngToPalette));
  }

  return result;
}

type ValidatedOptions = ConvertOptions & {
  dpi: number;
  mode: 'raster' | 'extract';
};

function validateOptions(options: ConvertOptions): ValidatedOptions {
  if (!options.output || typeof options.output !== 'string') {
    throw new PdfToImageError(
      '`output` is required and must be a non-empty string.',
      'INVALID_OPTIONS'
    );
  }

  const dpi = options.dpi ?? 300;
  if (!Number.isFinite(dpi) || dpi < MIN_DPI || dpi > MAX_DPI) {
    throw new PdfToImageError(
      `\`dpi\` must be a finite number between ${MIN_DPI} and ${MAX_DPI} (got ${dpi}).`,
      'INVALID_OPTIONS'
    );
  }

  const mode = options.mode ?? 'raster';
  if (!VALID_MODES.includes(mode)) {
    throw new PdfToImageError(
      `\`mode\` must be one of ${VALID_MODES.join(', ')} (got "${mode}").`,
      'INVALID_OPTIONS'
    );
  }

  if (options.strategy && !VALID_STRATEGIES.includes(options.strategy)) {
    throw new PdfToImageError(
      `\`strategy\` must be one of ${VALID_STRATEGIES.join(', ')} (got "${options.strategy}").`,
      'INVALID_OPTIONS'
    );
  }

  assertPositiveInt(options.firstPage, 'firstPage');
  assertPositiveInt(options.lastPage, 'lastPage');
  if (
    options.firstPage !== undefined &&
    options.lastPage !== undefined &&
    options.firstPage > options.lastPage
  ) {
    throw new PdfToImageError(
      `\`firstPage\` (${options.firstPage}) must be ≤ \`lastPage\` (${options.lastPage}).`,
      'INVALID_OPTIONS'
    );
  }

  return { ...options, dpi, mode };
}

function assertPositiveInt(value: number | undefined, name: string): void {
  if (value === undefined) return;
  if (!Number.isInteger(value) || value < 1) {
    throw new PdfToImageError(
      `\`${name}\` must be a positive integer (got ${value}).`,
      'INVALID_OPTIONS'
    );
  }
}

async function runAuto(
  mode: 'raster' | 'extract',
  input: string,
  opts: ValidatedOptions,
  bins: ReturnType<typeof detectBinaries>
): Promise<ConvertResult> {
  if (mode === 'extract') {
    if (!bins.pdfimages) {
      throw new PdfToImageError(
        'Extract mode requires pdfimages (part of Poppler). Install Poppler or use mode: "raster" which works out of the box via the bundled pdfjs backend.',
        'EXTRACT_NEEDS_POPPLER'
      );
    }
    return { strategy: 'pdfimages', files: await runPdfimages(bins.pdfimages, input, opts) };
  }

  // Raster mode: prefer native tools for quality, fall back to bundled pdfjs (always available).
  if (bins.pdftoppm) {
    return { strategy: 'pdftoppm', files: await runPdftoppm(bins.pdftoppm, input, opts) };
  }
  if (bins.ghostscript) {
    return { strategy: 'ghostscript', files: await runGhostscript(bins.ghostscript, input, opts) };
  }
  return { strategy: 'pdfjs', files: await runPdfjs(input, opts) };
}

async function runForced(
  strategy: Strategy,
  input: string,
  opts: ValidatedOptions,
  bins: ReturnType<typeof detectBinaries>
): Promise<ConvertResult> {
  switch (strategy) {
    case 'pdfjs':
      return { strategy, files: await runPdfjs(input, opts) };
    case 'pdftoppm':
      if (!bins.pdftoppm) throw new NoBinaryAvailableError();
      return { strategy, files: await runPdftoppm(bins.pdftoppm, input, opts) };
    case 'pdfimages':
      if (!bins.pdfimages) throw new NoBinaryAvailableError();
      return { strategy, files: await runPdfimages(bins.pdfimages, input, opts) };
    case 'ghostscript':
      if (!bins.ghostscript) throw new NoBinaryAvailableError();
      return { strategy, files: await runGhostscript(bins.ghostscript, input, opts) };
    default: {
      const exhaustive: never = strategy;
      throw new PdfToImageError(
        `Unknown strategy: ${String(exhaustive)}`,
        'INVALID_OPTIONS'
      );
    }
  }
}
