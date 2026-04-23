#!/usr/bin/env node
import { rename } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { Command } from 'commander';
import { convert } from './convert.js';
import { detectBinaries } from './detect.js';
import { PdfToImageError } from './errors.js';
import type { ConvertMode, Strategy } from './types.js';

const program = new Command();

program
  .name('ukz-pdf-to-image')
  .description('Convert a PDF to PNG without losing resolution')
  .version('0.1.0');

program
  .command('detect')
  .description('Show which PDF backends are available on this machine')
  .action(() => {
    const bins = detectBinaries();
    console.log('Available backends:');
    console.log(`  pdfjs       : bundled (always available)`);
    console.log(`  pdftoppm    : ${bins.pdftoppm ?? 'not found'}`);
    console.log(`  pdfimages   : ${bins.pdfimages ?? 'not found'}`);
    console.log(`  ghostscript : ${bins.ghostscript ?? 'not found'}`);
  });

program
  .option('--pdf <path>', 'Path to the input PDF')
  .option('--imagen <path>', 'Output image path (use .png for best quality on Windows)')
  .option('--image <path>', 'Alias for --imagen')
  .option('-r, --dpi <n>', 'DPI used when rasterizing', '300')
  .option('-m, --mode <mode>', 'raster | extract', 'raster')
  .option('-f, --first <page>', 'First page (1-indexed)')
  .option('-l, --last <page>', 'Last page (1-indexed, inclusive)')
  .option('-s, --strategy <name>', 'Force a backend: pdfjs | pdftoppm | pdfimages | ghostscript')
  .option('--optimize', 'Convert output to indexed-palette PNG (lossless for diagrams, 4-8x smaller)')
  .action(async (opts: Record<string, string | boolean | undefined>) => {
    const pdf = opts.pdf as string | undefined;
    const out = (opts.imagen ?? opts.image) as string | undefined;

    if (!pdf || !out) {
      program.help();
      return;
    }

    const ext = extname(out).toLowerCase();
    if (ext !== '.png') {
      console.warn(
        `Warning: only .png is currently supported (got "${ext || 'no extension'}"). Output will be PNG.`
      );
    }

    // pdftoppm/pdfimages/gs all use a PREFIX + append `-<page>.png`,
    // so we split the desired output path into (dir, basename-without-ext) and pass that.
    const absOut = resolve(out);
    const prefix = join(dirname(absOut), basename(absOut, extname(absOut)));

    try {
      const result = await convert(pdf, {
        output: prefix,
        dpi: Number(opts.dpi),
        mode: opts.mode as ConvertMode,
        firstPage: opts.first ? Number(opts.first) : undefined,
        lastPage: opts.last ? Number(opts.last) : undefined,
        // `convert` validates this against the allowed strategy names.
        strategy: opts.strategy as Strategy | undefined,
        optimize: Boolean(opts.optimize),
      });

      // If the PDF produced exactly one image, honor the exact filename the user asked for.
      let files = result.files;
      if (files.length === 1 && files[0]) {
        await rename(files[0], absOut);
        files = [absOut];
      }

      console.log(`Converted using: ${result.strategy}`);
      for (const f of files) console.log(`  ${f}`);
    } catch (err) {
      if (err instanceof PdfToImageError) {
        console.error(`\n${err.message}`);
        process.exit(1);
      }
      throw err;
    }
  });

program.parseAsync().catch((err) => {
  console.error(err);
  process.exit(1);
});
