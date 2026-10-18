import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import open from 'open';

/**
 * Overleaf's /docs endpoint accepts a POSTed snippet. We write a tiny HTML page
 * that auto-submits the form and open it in the browser — no server, no URL length limits.
 * https://www.overleaf.com/devs
 */
export function overleafHtml(tex: string, name = 'resume.tex'): string {
  // encodeURIComponent escapes " < > & so the value is safe inside a double-quoted attribute.
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Opening in Overleaf…</title></head>
<body style="font-family:system-ui;padding:2rem">
<p>Opening your resume in Overleaf… If nothing happens, click the button.</p>
<form id="f" action="https://www.overleaf.com/docs" method="post">
  <input type="hidden" name="encoded_snip" value="${encodeURIComponent(tex)}">
  <input type="hidden" name="snip_name" value="${encodeURIComponent(name)}">
  <input type="hidden" name="engine" value="pdflatex">
  <button type="submit">Open in Overleaf</button>
</form>
<script>document.getElementById('f').submit();</script>
</body></html>
`;
}

export async function openInOverleaf(tex: string, name?: string): Promise<string> {
  const file = path.join(os.tmpdir(), `lockedin-overleaf-${Date.now()}.html`);
  await fs.writeFile(file, overleafHtml(tex, name), 'utf8');
  await open(file);
  return file;
}
