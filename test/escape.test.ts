import { describe, expect, it } from 'vitest';
import { displayUrl, escapeLatex, escapeUrl, normalizeUrl } from '../src/latex/escape.js';

describe('escapeLatex', () => {
  it('escapes every LaTeX special character', () => {
    expect(escapeLatex('a & b % c $ d # e _ f { g } h')).toBe('a \\& b \\% c \\$ d \\# e \\_ f \\{ g \\} h');
    expect(escapeLatex('~ ^ \\')).toBe('\\textasciitilde{} \\textasciicircum{} \\textbackslash{}');
    expect(escapeLatex('a < b > c | d')).toBe('a \\textless{} b \\textgreater{} c \\textbar{} d');
  });

  it('does not double-escape the backslash replacement braces', () => {
    expect(escapeLatex('\\{')).toBe('\\textbackslash{}\\{');
  });

  it('maps common unicode punctuation and drops emoji', () => {
    expect(escapeLatex('2022 – 2026')).toBe('2022 -- 2026');
    expect(escapeLatex('IPC → BNS')).toBe('IPC $\\rightarrow$ BNS');
    expect(escapeLatex('shipped 🚀 fast')).toBe('shipped fast');
    expect(escapeLatex('₹5L stipend')).toBe('Rs.5L stipend');
  });

  it('keeps accented latin letters', () => {
    expect(escapeLatex('Café Résumé')).toBe('Café Résumé');
  });

  it('turns **bold** into \\textbf after escaping', () => {
    expect(escapeLatex('Used **C# & .NET** daily')).toBe('Used \\textbf{C\\# \\& .NET} daily');
  });
});

describe('url helpers', () => {
  it('escapes % and # for \\href', () => {
    expect(escapeUrl('https://x.com/a%20b#top')).toBe('https://x.com/a\\%20b\\#top');
  });
  it('adds https to bare domains, leaves mailto alone', () => {
    expect(normalizeUrl('github.com/me')).toBe('https://github.com/me');
    expect(normalizeUrl('mailto:a@b.c')).toBe('mailto:a@b.c');
  });
  it('produces readable link text', () => {
    expect(displayUrl('https://www.linkedin.com/in/priya/')).toBe('linkedin.com/in/priya');
  });
});
