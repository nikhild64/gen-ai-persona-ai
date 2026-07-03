/**
 * AD-20 — WCAG 2.1 relative-luminance / contrast-ratio check. Unit tests
 * (E4-S2 onwards) call `assertContrast(bg, fg)` to enforce that every
 * persona-theme accent + on-color pairing hits AA:
 *  - normal text  → ≥ 4.5:1
 *  - large text   → ≥ 3.0:1 (≥18pt OR ≥14pt bold)
 */

function relativeLuminance(hex: string): number {
  const cleaned = hex.replace('#', '');
  const pairs = cleaned.match(/.{2}/g);
  if (!pairs || pairs.length !== 3) {
    throw new Error(`Invalid hex colour: ${hex} (expected #RRGGBB)`);
  }
  const [r, g, b] = pairs.map((h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(bgHex: string, fgHex: string): number {
  const l1 = relativeLuminance(bgHex);
  const l2 = relativeLuminance(fgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function assertContrast(
  bg: string,
  fg: string,
  mode: 'normal' | 'large-text' = 'normal',
): void {
  const ratio = contrastRatio(bg, fg);
  const threshold = mode === 'large-text' ? 3.0 : 4.5;
  if (ratio < threshold) {
    throw new Error(
      `Contrast ratio ${ratio.toFixed(2)}:1 between bg ${bg} and fg ${fg} ` +
        `fails WCAG AA (${mode}, threshold ${threshold}:1).`,
    );
  }
}

export const __test__ = { relativeLuminance, contrastRatio };
