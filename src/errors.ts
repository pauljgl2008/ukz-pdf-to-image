export class PdfToImageError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PdfToImageError';
  }
}

export class NoBinaryAvailableError extends PdfToImageError {
  constructor() {
    super(
      [
        'No PDF conversion binary was found on PATH.',
        'Install at least one of the following:',
        '',
        '  Poppler (recommended — provides pdftoppm + pdfimages):',
        '    Windows: winget install oschwartz10612.Poppler',
        '    macOS:   brew install poppler',
        '    Linux:   sudo apt install poppler-utils',
        '',
        '  Ghostscript (raster fallback):',
        '    Windows: winget install ArtifexSoftware.GhostScript',
        '    macOS:   brew install ghostscript',
        '    Linux:   sudo apt install ghostscript',
      ].join('\n'),
      'NO_BINARY'
    );
  }
}

export class ConversionFailedError extends PdfToImageError {
  constructor(message: string, public stderr?: string) {
    super(message + (stderr ? `\n${stderr.trim()}` : ''), 'CONVERSION_FAILED');
  }
}
