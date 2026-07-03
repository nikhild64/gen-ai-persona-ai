import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { PersonaRoutingService } from './persona-routing.service';
import { KeyVaultService } from './key-vault.service';

describe('PersonaRoutingService', () => {
  let routing: PersonaRoutingService;
  let keyVault: KeyVaultService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    routing = TestBed.inject(PersonaRoutingService);
    keyVault = TestBed.inject(KeyVaultService);
  });

  it('uses configured routing when both provider keys exist', () => {
    keyVault.setKey('gemini', 'AIzaSy-test-gemini-key');
    keyVault.setKey('groq', 'gsk_test-groq-key');
    expect(routing.getProviderFor('musk')).toBe('groq');
    expect(routing.getProviderFor('jobs')).toBe('gemini');
  });

  it('routes all personas to Gemini when only a Gemini key is saved', () => {
    keyVault.setKey('gemini', 'AIzaSy-test-gemini-key');
    expect(routing.getProviderFor('musk')).toBe('gemini');
    expect(routing.getProviderFor('jobs')).toBe('gemini');
    expect(routing.getProviderFor('newton')).toBe('gemini');
  });

  it('routes all personas to Groq when only a Groq key is saved', () => {
    keyVault.setKey('groq', 'gsk_test-groq-key');
    expect(routing.getProviderFor('musk')).toBe('groq');
    expect(routing.getProviderFor('jobs')).toBe('groq');
    expect(routing.getProviderFor('einstein')).toBe('groq');
  });

  it('hasKeyForPersona reflects the effective provider key', () => {
    expect(routing.hasKeyForPersona('musk')).toBe(false);
    keyVault.setKey('gemini', 'AIzaSy-test-gemini-key');
    expect(routing.hasKeyForPersona('musk')).toBe(true);
  });
});
