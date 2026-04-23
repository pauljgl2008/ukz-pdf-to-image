import { createCanvas } from '@napi-rs/canvas';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import type { PDFPageProxy, PageViewport } from 'pdfjs-dist';
import { ConversionFailedError } from '../errors.js';
import type { ConvertOptions } from '../types.js';

const nodeRequire = createRequire(import.meta.url);

// The PDF coordinate system is defined at 72 DPI, so viewport scale = targetDPI / 72.
const PDF_BASE_DPI = 72;

// Conservative per-tile dimension cap. Skia (used by @napi-rs/canvas) starts
// rejecting surfaces somewhere around 26-28k per side plus a total-pixel budget,
// so we keep each tile comfortably under that to avoid edge cases.
const MAX_TILE_SIDE = 16000;

export async function runPdfjs(
  input: string,
  options: ConvertOptions & { dpi: number }
): Promise<string[]> {
  // The legacy build ships the Node.js-compatible entry (polyfills DOMMatrix, Path2D, etc.).
  const pdfjs = (await import(
    'pdfjs-dist/legacy/build/pdf.mjs'
  )) as typeof import('pdfjs-dist');

  const pdfjsRoot = dirname(nodeRequire.resolve('pdfjs-dist/package.json'));
  const standardFontDataUrl = join(pdfjsRoot, 'standard_fonts') + '/';
  const cMapUrl = join(pdfjsRoot, 'cmaps') + '/';

  const data = new Uint8Array(await readFile(input));

  const loadingTask = pdfjs.getDocument({
    data,
    standardFontDataUrl,
    cMapUrl,
    cMapPacked: true,
    // useSystemFonts lets PDF.js substitute missing/embedded fonts with system fonts, which render crisper.
    useSystemFonts: true,
  });

  const doc = await loadingTask.promise;

  try {
    const firstPage = options.firstPage ?? 1;
    const lastPage = Math.min(options.lastPage ?? doc.numPages, doc.numPages);
    const scale = options.dpi / PDF_BASE_DPI;

    const outPrefix = resolve(options.output);
    const files: string[] = [];

    for (let pageNum = firstPage; pageNum <= lastPage; pageNum++) {
      const page = await doc.getPage(pageNum);
      try {
        const viewport = page.getViewport({ scale });
        const width = Math.ceil(viewport.width);
        const height = Math.ceil(viewport.height);
        const filename = `${outPrefix}-${pageNum}.png`;

        if (width > MAX_TILE_SIDE || height > MAX_TILE_SIDE) {
          await renderTiled(page, viewport, width, height, filename);
        } else {
          await renderSingle(page, viewport, width, height, filename);
        }

        files.push(filename);
      } catch (err) {
        throw new ConversionFailedError(
          `pdfjs failed on page ${pageNum}: ${(err as Error).message}`
        );
      } finally {
        page.cleanup();
      }
    }

    return files;
  } finally {
    await doc.destroy();
  }
}

async function renderSingle(
  page: PDFPageProxy,
  viewport: PageViewport,
  width: number,
  height: number,
  outputFile: string
): Promise<void> {
  const canvas = createCanvas(width, height);
  await page.render({
    canvas: canvas as unknown as HTMLCanvasElement,
    viewport,
    intent: 'print',
  }).promise;
  const png = await canvas.encode('png');
  await writeFile(outputFile, png);
}

async function renderTiled(
  page: PDFPageProxy,
  fullViewport: PageViewport,
  fullWidth: number,
  fullHeight: number,
  outputFile: string
): Promise<void> {
  const cols = Math.max(1, Math.ceil(fullWidth / MAX_TILE_SIDE));
  const rows = Math.max(1, Math.ceil(fullHeight / MAX_TILE_SIDE));
  const tileWidth = Math.ceil(fullWidth / cols);
  const tileHeight = Math.ceil(fullHeight / rows);

  const composites: Array<{ input: Buffer; left: number; top: number }> = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * tileWidth;
      const y = row * tileHeight;
      const w = Math.min(tileWidth, fullWidth - x);
      const h = Math.min(tileHeight, fullHeight - y);

      // offsetX/offsetY in device (pixel) space shifts the rendered content so
      // the region that would have landed at (x, y) on a full-size canvas now
      // lands at (0, 0) on this tile-sized canvas.
      const tileViewport = fullViewport.clone({
        offsetX: -x,
        offsetY: -y,
      });

      const canvas = createCanvas(w, h);
      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        viewport: tileViewport,
        intent: 'print',
      }).promise;

      const buf = await canvas.encode('png');
      composites.push({ input: Buffer.from(buf), left: x, top: y });
    }
  }

  await sharp({
    create: {
      width: fullWidth,
      height: fullHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
    // sharp's default input-pixel guard (~268M) rejects the full-size canvas.
    // We intentionally need that size here; tiles themselves stay under the limit.
    limitInputPixels: false,
  })
    .composite(composites)
    .png({ compressionLevel: 6 })
    .toFile(outputFile);
}
