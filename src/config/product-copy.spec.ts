import { describe, it, expect } from 'vitest';

import { PRODUCT_COPY } from './product-copy';

describe('product-copy (AD-22 chrome separation)', () => {
  it('exports the landing hero, disclaimer, and CTA strings', () => {
    expect(PRODUCT_COPY.landingHeroTitle.length).toBeGreaterThan(0);
    expect(PRODUCT_COPY.landingDisclaimerBand).toMatch(/parody/i);
    expect(PRODUCT_COPY.landingCtaLabel).toMatch(/chat/i);
  });

  it('exposes footer disclaimer + takedown contact per AD-22', () => {
    expect(PRODUCT_COPY.footerDisclaimer).toMatch(/parody/i);
    expect(PRODUCT_COPY.takedownEmail).toContain('@');
  });

  it('carries the settings auto-open header exactly per AD-22 documented exception', () => {
    expect(PRODUCT_COPY.settingsAutoOpenHeader).toBe(
      'Chai chalega? Paste an API key to start chatting.',
    );
  });

  it('carries the askBothGreeting BYTE-IDENTICAL to Addendum §D.3', () => {
    expect(PRODUCT_COPY.askBothGreeting).toBe(
      'Haanji! Welcome back. Aap Ask-Both mode mein ho — same sawaal poocho, dono jawab denge. Hitesh pehle bolega, phir Piyush uska take dekh ke apna angle add karega. Chai le lo, aur try karo — ek deep question daalo, dekhte hain kya nikalta hai.',
    );
  });

  it('renders provider-parameterised helpers', () => {
    expect(PRODUCT_COPY.keyStatusUsingLabel('gemini')).toMatch(/Gemini/);
    expect(PRODUCT_COPY.keyFormatHelper('groq')).toMatch(/gsk_/);
    expect(PRODUCT_COPY.retryAfterHint(30)).toContain('30s');
  });
});
