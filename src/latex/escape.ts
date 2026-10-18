const SPECIALS: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '&': '\\&',
  '%': '\\%',
  $: '\\$',
  '#': '\\#',
  _: '\\_',
  '{': '\\{',
  '}': '\\}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
  '<': '\\textless{}',
  '>': '\\textgreater{}',
  '|': '\\textbar{}',
};

// Characters pdflatex (T1 + utf8) can't typeset out of the box.
const UNICODE: Record<string, string> = {
  '–': '--',
  '—': '---',
  '‘': '`',
  '’': "'",
  '“': '``',
  '”': "''",
  '…': '\\ldots{}',
  '•': '$\\bullet$',
  '·': '$\\cdot$',
  '→': '$\\rightarrow$',
  '←': '$\\leftarrow$',
  '↑': '$\\uparrow$',
  '↓': '$\\downarrow$',
  '≥': '$\\geq$',
  '≤': '$\\leq$',
  '×': '$\\times$',
  '±': '$\\pm$',
  '≈': '$\\approx$',
  '₹': 'Rs.',
  '€': '\\texteuro{}',
  '✓': '',
  '✔': '',
  '\u00a0': ' ',
  '\u200b': '',
};


/**
 * Escape arbitrary text for LaTeX body content.
 * `**bold**` spans become \textbf{} (applied after escaping, so content stays safe).
 */
export function escapeLatex(input: string): string {
  let out = '';
  for (const ch of input) {
    if (ch in UNICODE) {
      out += UNICODE[ch];
    } else if (ch in SPECIALS) {
      out += SPECIALS[ch];
    } else if (ch.codePointAt(0)! > 0x24f && !/\p{L}/u.test(ch)) {
      // Drop emoji / symbols outside Latin ranges that would break pdflatex.
      continue;
    } else {
      out += ch;
    }
  }
  return out.replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}').replace(/[ \t]{2,}/g, ' ').trim();
}

/** Escape a URL for the first argument of \href. */
export function escapeUrl(url: string): string {
  return url
    .trim()
    .replace(/\\/g, '')
    .replace(/[{}]/g, (c) => encodeURIComponent(c))
    .replace(/%/g, '\\%')
    .replace(/#/g, '\\#');
}

/** Ensure a scheme so \href works ("github.com/x" → "https://github.com/x"). */
export function normalizeUrl(url: string): string {
  const u = url.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return u;
  return `https://${u}`;
}

/** Human-friendly link text: drop scheme, www and trailing slash. */
export function displayUrl(url: string): string {
  return url
    .trim()
    .replace(/^mailto:/i, '')
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}
