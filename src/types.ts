export type ConvertMode = 'raster' | 'extract';

export type Strategy = 'pdftoppm' | 'pdfimages' | 'ghostscript' | 'pdfjs';

export interface ConvertOptions {
  /** Output path prefix. Produced files will be named `<output>-<page>.png`. */
  output: string;
  /** Resolution used when rasterizing. Ignored in `extract` mode. Default: 300. */
  dpi?: number;
  /** `raster` renders the PDF to PNG at the given DPI; `extract` pulls embedded images at native resolution. Default: `raster`. */
  mode?: ConvertMode;
  /** First page to process (1-indexed). */
  firstPage?: number;
  /** Last page to process (1-indexed, inclusive). */
  lastPage?: number;
  /** Force a specific backend. By default the best available is chosen. */
  strategy?: Strategy;
  /** Post-process PNG output to use an indexed palette — lossless for diagrams, dramatic size reduction. */
  optimize?: boolean;
}

export interface ConvertResult {
  strategy: Strategy;
  files: string[];
}

export interface DetectedBinaries {
  pdftoppm: string | null;
  pdfimages: string | null;
  ghostscript: string | null;
}
