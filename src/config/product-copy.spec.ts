import { describe, it, expect } from 'vitest';

import { PRODUCT_COPY } from './product-copy';

describe('product-copy (AD-22 chrome separation)', () => {
  it('exports the landing hero, disclaimer, and CTA strings', () => {
    expect(PRODUCT_COPY.landingHeroTitle).toMatch(/Council/i);
    expect(PRODUCT_COPY.landingDisclaimerBand).toMatch(/parody/i);
    expect(PRODUCT_COPY.landingCtaLabel).toMatch(/chat/i);
  });

  it('exposes footer disclaimer + takedown contact per AD-22', () => {
    expect(PRODUCT_COPY.footerDisclaimer).toMatch(/parody/i);
    expect(PRODUCT_COPY.takedownEmail).toContain('@');
  });

  it('carries the settings auto-open header for Council', () => {
    expect(PRODUCT_COPY.settingsAutoOpenHeader).toBe(
      'Paste an API key to start chatting with Council.',
    );
  });

  it('carries the generic askBothGreeting for blended pair mode', () => {
    expect(PRODUCT_COPY.askBothGreeting).toMatch(/Ask Both/i);
    expect(PRODUCT_COPY.askBothGreeting).toMatch(/fused/i);
  });

  it('renders provider-parameterised helpers', () => {
    expect(PRODUCT_COPY.keyStatusUsingLabel('gemini')).toMatch(/Gemini/);
    expect(PRODUCT_COPY.keyFormatHelper('groq')).toMatch(/gsk_/);
    expect(PRODUCT_COPY.retryAfterHint(30)).toContain('30s');
  });

  it('AC-11: exposes the Ask-Both variant toggle labels (Sequential / Parallel / Blended)', () => {
    expect(PRODUCT_COPY.askBothVariantLabels.sequential).toBe('Sequential');
    expect(PRODUCT_COPY.askBothVariantLabels.parallel).toBe('Parallel');
    expect(PRODUCT_COPY.askBothVariantLabels.blended).toBe('Blended');
  });

  it('AC-9: tooltip explains the 1-LLM-call cost multiplier vs 2 for the other variants', () => {
    expect(PRODUCT_COPY.askBothVariantTooltip).toContain('1 LLM call');
    expect(PRODUCT_COPY.askBothVariantTooltip).toContain('Sequential is 2');
    expect(PRODUCT_COPY.askBothVariantTooltip).toContain('Parallel is 2');
  });

  it('AC-4: blended attribution helper accepts pair label', () => {
    expect(PRODUCT_COPY.askBothBlendedAttribution('Musk + Jobs')).toBe(
      'Musk + Jobs',
    );
  });

  it('exposes a blended-specific streaming indicator label', () => {
    const label = PRODUCT_COPY.streamingIndicatorAskBothBlended('Hitesh + Piyush');
    expect(label.length).toBeGreaterThan(0);
    expect(label).toContain('Hitesh');
    expect(label).toContain('Piyush');
  });
});
