/**
 * Render a captured Ink terminal frame (raw ANSI log) as a macOS-style terminal window SVG.
 * Usage: tsx scripts/shots/term-shot.ts <raw.log> <out.svg> [--lines N] [--title T] [--replace from=>to]...
 */
import fs from 'node:fs';

const args = process.argv.slice(2);
const [input, output] = args;
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const replaces = args.flatMap((a, i) => (a === '--replace' ? [args[i + 1]!.split('=>') as [string, string]] : []));
const maxLines = Number(opt('lines') ?? 999);
const title = opt('title') ?? 'lockedin';

let raw = fs.readFileSync(input!, 'utf8');
// Last synchronized-output block = the last full frame Ink painted.
const blocks = raw.split('\x1b[?2026h');
raw = blocks[blocks.length - 1]!.split('\x1b[?2026l')[0]!;
// Drop Ink's erase-previous-frame prefix and cursor movement.
raw = raw.replace(/^(\x1b\[2K|\x1b\[1A|\x1b\[G)+/, '');
for (const [from, to] of replaces) raw = raw.split(from!).join(to!);

const BASIC: Record<number, string> = {
  30: '#1e1e2e', 31: '#f87171', 32: '#4ade80', 33: '#facc15', 34: '#60a5fa', 35: '#c084fc', 36: '#22d3ee', 37: '#e5e7eb',
  90: '#6b7280', 91: '#fca5a5', 92: '#86efac', 93: '#fde68a', 94: '#93c5fd', 95: '#d8b4fe', 96: '#67e8f9', 97: '#ffffff',
};
const FG = '#e5e7eb';
const BG = '#11111b';

interface Span { text: string; fg: string; bold: boolean; dim: boolean; italic: boolean; inverse: boolean }
type Line = Span[];

const lines: Line[] = [[]];
let st = { fg: FG, bold: false, dim: false, italic: false, inverse: false };
const re = /\x1b\[([0-9;?]*)([A-Za-z])|([^\x1b]+)/g;
for (let m; (m = re.exec(raw)); ) {
  if (m[3] !== undefined) {
    const parts = m[3].split('\n');
    parts.forEach((p, i) => {
      if (i > 0) lines.push([]);
      if (p) lines[lines.length - 1]!.push({ text: p, ...st });
    });
    continue;
  }
  if (m[2] !== 'm') continue;
  const ps = (m[1] || '0').split(';').map(Number);
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]!;
    if (p === 0) st = { fg: FG, bold: false, dim: false, italic: false, inverse: false };
    else if (p === 1) st.bold = true;
    else if (p === 2) st.dim = true;
    else if (p === 3) st.italic = true;
    else if (p === 7) st.inverse = true;
    else if (p === 22) (st.bold = false), (st.dim = false);
    else if (p === 23) st.italic = false;
    else if (p === 27) st.inverse = false;
    else if (p === 39) st.fg = FG;
    else if (p === 38 && ps[i + 1] === 2) {
      st.fg = `#${ps.slice(i + 2, i + 5).map((n) => n.toString(16).padStart(2, '0')).join('')}`;
      i += 4;
    } else if (BASIC[p]) st.fg = BASIC[p]!;
  }
}
while (lines.length && lines[lines.length - 1]!.every((s) => !s.text.trim())) lines.pop();
const shown = lines.slice(0, maxLines);

const FS = 14;
const CW = FS * 0.602;
const LH = FS * 1.22;
const PAD = 22;
const BAR = 34;
const cols = Math.max(60, ...shown.map((l) => [...l.map((s) => s.text).join('')].length));
const W = Math.ceil(cols * CW + PAD * 2);
const H = Math.ceil(BAR + PAD + shown.length * LH + PAD * 0.6);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const body = shown
  .map((line, row) => {
    let col = 0;
    const y = BAR + PAD + row * LH + FS;
    return line
      .map((s) => {
        const x = PAD + col * CW;
        const len = [...s.text].length;
        col += len;
        const rect = s.inverse ? `<rect x="${x}" y="${y - FS + 2}" width="${len * CW}" height="${FS + 3}" fill="${s.fg}"/>` : '';
        const attrs = [
          `x="${x.toFixed(1)}"`,
          `y="${y.toFixed(1)}"`,
          `fill="${s.inverse ? BG : s.fg}"`,
          s.bold ? 'font-weight="700"' : '',
          s.dim ? 'opacity="0.55"' : '',
          s.italic ? 'font-style="italic"' : '',
        ].join(' ');
        return `${rect}<text ${attrs} xml:space="preserve">${esc(s.text)}</text>`;
      })
      .join('');
  })
  .join('\n');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" rx="10" fill="${BG}"/>
<rect width="${W}" height="${BAR}" rx="10" fill="#1b1b29"/><rect y="${BAR - 10}" width="${W}" height="10" fill="#1b1b29"/>
<circle cx="20" cy="17" r="6" fill="#ff5f57"/><circle cx="40" cy="17" r="6" fill="#febc2e"/><circle cx="60" cy="17" r="6" fill="#28c840"/>
<text x="${W / 2}" y="22" fill="#6b7280" font-size="13" text-anchor="middle" font-family="-apple-system, Helvetica, sans-serif">${esc(title)}</text>
<g font-family="Menlo, 'SF Mono', Monaco, Consolas, monospace" font-size="${FS}">
${body}
</g>
</svg>
`;
fs.writeFileSync(output!, svg);
console.log(`${output}: ${shown.length} lines, ${W}x${H}`);
