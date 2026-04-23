# ukz-pdf-to-image

Convert PDFs to PNG without losing resolution. Zero-config — works out of the box with a bundled [PDF.js](https://mozilla.github.io/pdf.js/) renderer. If `pdftoppm`, `pdfimages`, or `ghostscript` are on PATH, they are picked up automatically for higher quality.

## Install

```bash
npm install ukz-pdf-to-image
```

Requires Node.js ≥ 20.19.

## CLI

```bash
ukz-pdf-to-image --pdf input.pdf --imagen output.png              # 300 DPI
ukz-pdf-to-image --pdf input.pdf --imagen output.png -r 3000      # max fidelity
ukz-pdf-to-image --pdf input.pdf --imagen output.png --optimize   # lossless, 4-8x smaller (diagrams)
ukz-pdf-to-image --pdf input.pdf --imagen output.png -f 1 -l 5    # pages 1..5
ukz-pdf-to-image detect                                           # show available backends
```

Multi-page PDFs produce `output-1.png`, `output-2.png`, …

## API

```ts
import { convert } from 'ukz-pdf-to-image';

const { files, strategy } = await convert('input.pdf', {
  output: './out/page',
  dpi: 300,
});
```

| Option | Default | Notes |
|---|---|---|
| `output` | — | Required. Path prefix for generated files. |
| `dpi` | `300` | Range 36–4800. |
| `mode` | `'raster'` | `'raster'` renders the page; `'extract'` pulls embedded images (requires Poppler). |
| `firstPage` / `lastPage` | — | 1-indexed, inclusive. |
| `strategy` | auto | Force `'pdfjs'`, `'pdftoppm'`, `'pdfimages'`, or `'ghostscript'`. |
| `optimize` | `false` | Indexed-palette PNG. Lossless on line-art; may band on photos. |

Invalid options throw `PdfToImageError` with code `INVALID_OPTIONS`.

## Security

Do not run this on untrusted PDFs without process isolation (separate user, container, sandbox). PDF parsers have a long CVE history. Ghostscript is invoked with `-dSAFER`; `pdfjs-dist` should be kept up to date (`npm audit`).

## Repository

https://github.com/pauljgl2008/ukz-pdf-to-image

## License

MIT
