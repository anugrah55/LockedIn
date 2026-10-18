import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const SUPPORTED_CV_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md', '.tex'];

/** Normalise a path typed or drag-dropped into a terminal (quotes, `\ ` escapes, ~). */
export function normalizeInputPath(input: string): string {
  let p = input.trim();
  if ((p.startsWith("'") && p.endsWith("'")) || (p.startsWith('"') && p.endsWith('"'))) {
    p = p.slice(1, -1);
  }
  p = p.replace(/\\(.)/g, '$1');
  if (p === '~' || p.startsWith('~/')) p = path.join(os.homedir(), p.slice(1));
  return path.resolve(p);
}

export interface ExtractedCv {
  text: string;
  links: string[];
}

export async function extractCv(file: string): Promise<ExtractedCv> {
  const ext = path.extname(file).toLowerCase();
  const buf = await fs.readFile(file);
  let result: ExtractedCv;
  switch (ext) {
    case '.pdf':
      result = await extractPdf(buf);
      break;
    case '.docx': {
      const mammoth = (await import('mammoth')).default;
      const { value } = await mammoth.extractRawText({ buffer: buf });
      result = { text: value, links: [] };
      break;
    }
    case '.txt':
    case '.md':
    case '.tex':
      result = { text: buf.toString('utf8'), links: [] };
      break;
    default:
      throw new Error(`Unsupported CV format "${ext}". Use one of: ${SUPPORTED_CV_EXTENSIONS.join(', ')}`);
  }
  result.text = result.text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
  if (result.text.length < 50) {
    throw new Error('Could not read text from this CV. If it is a scanned image, export a text-based PDF instead.');
  }
  return result;
}

async function extractPdf(buf: Buffer): Promise<ExtractedCv> {
  const { getDocumentProxy, extractText } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  // Hyperlinks (LinkedIn, GitHub, project demos) often live only in annotations.
  const links = new Set<string>();
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    for (const a of (await page.getAnnotations()) as { url?: string }[]) {
      if (a.url) links.add(a.url);
    }
  }
  return { text, links: [...links] };
}
