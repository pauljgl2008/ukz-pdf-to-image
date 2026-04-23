import { rename, unlink } from 'node:fs/promises';
import sharp from 'sharp';

// Indexed-palette PNG is lossless for content with <=256 distinct colors
// (typical for diagrams, schemas, code screenshots) and reduces file size 4-8x
// versus 32-bit RGBA. For photographic PDFs with smooth gradients it can
// introduce visible banding, which is why this is opt-in via --optimize.
export async function optimizePngToPalette(file: string): Promise<void> {
  const tmpFile = file + '.tmp';
  try {
    await sharp(file, { limitInputPixels: false })
      .png({ palette: true, colours: 256, compressionLevel: 9 })
      .toFile(tmpFile);
    await rename(tmpFile, file);
  } catch (err) {
    try {
      await unlink(tmpFile);
    } catch {
      // tmp file may not exist; ignore
    }
    throw err;
  }
}
