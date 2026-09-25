/**
 * Design-token contrast regression tests (WCAG 2.1 AA)
 *
 * The journal's secondary text once sat at 3.28:1 (ink3) and 2.30:1 (ink4)
 * against the paper ground — invisible in a screenshot, failing for readers.
 * These thresholds are locked here so a future "slightly lighter gray" edit
 * cannot silently regress readability.
 *
 * 1. text tokens ≥ 4.5:1 against --color-paper and --color-surface
 * 2. interactive control borders ≥ 3:1 (WCAG 1.4.11 non-text contrast)
 * 3. white text on filled backgrounds ≥ 4.5:1 (buttons, badges, checkbox)
 * 4. every expected token still exists (renames must not vacate the rules)
 *
 * Decorative hairlines (line / linesoft / linehover / hair) carry no
 * information and are exempt — state is never encoded by them alone.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

// --- read the @theme tokens -------------------------------------------------
const cssPath = resolve(dirname(fileURLToPath(import.meta.url)), '../index.css');
const css = readFileSync(cssPath, 'utf8');

const tokens = new Map<string, string>();
for (const match of css.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) {
  tokens.set(match[1], match[2].toLowerCase());
}

const token = (name: string): string => {
  const value = tokens.get(name);
  assert(value !== undefined, `token --color-${name} exists in src/index.css`);
  return value;
};

// --- WCAG relative luminance ------------------------------------------------
function channel(c: number): number {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const r = channel(parseInt(hex.slice(1, 3), 16) / 255);
  const g = channel(parseInt(hex.slice(3, 5), 16) / 255);
  const b = channel(parseInt(hex.slice(5, 7), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function assertAtLeast(value: number, threshold: number, message: string): void {
  assert(
    value >= threshold,
    `${message}: ${value.toFixed(2)}:1 < ${threshold}:1`
  );
}

// --- 1. text tokens on both grounds ----------------------------------------
const paper = token('paper');
const surface = token('surface');

const TEXT_TOKENS = ['ink', 'ink2', 'ink3', 'ink4', 'accent', 'seal', 'danger', 'tier2'];
for (const name of TEXT_TOKENS) {
  const hex = token(name);
  assertAtLeast(contrast(hex, paper), 4.5, `--color-${name} on paper`);
  assertAtLeast(contrast(hex, surface), 4.5, `--color-${name} on surface`);
}

// --- 2. interactive control borders (WCAG 1.4.11) ---------------------------
const control = token('control');
assertAtLeast(contrast(control, paper), 3.0, `--color-control border on paper`);
assertAtLeast(contrast(control, surface), 3.0, `--color-control border on surface`);

// --- 3. white text on filled backgrounds ------------------------------------
for (const name of ['ink', 'accent', 'seal', 'danger']) {
  assertAtLeast(contrast('#ffffff', token(name)), 4.5, `white on --color-${name}`);
}

// --- 4. required tokens present ---------------------------------------------
for (const name of [
  'paper',
  'surface',
  'surface2',
  'ink',
  'ink2',
  'ink3',
  'ink4',
  'accent',
  'control',
  'seal',
  'danger',
  'tier2',
]) {
  token(name);
}

console.log('ALL DESIGN-TOKEN CONTRAST TESTS PASSED.');
