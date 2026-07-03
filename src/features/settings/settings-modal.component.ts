import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';

import type { ProviderId } from '../../config/provider-registry';
import { KeyVaultService } from '../../domain/key-vault/key-vault.service';
import { PersonaRoutingService } from '../../domain/key-vault/persona-routing.service';
import { ModelSelectionService } from '../../domain/key-vault/model-selection.service';
import { ModelDiscoveryService } from '../../domain/key-vault/model-discovery.service';
import { AVAILABLE_MODELS } from '../../config/available-models';
import { ANALYTICS_PORT } from '../../domain/chat/di-tokens';
import { PRODUCT_COPY } from '../../config/product-copy';
import { modalDismissLabel } from '../../config/aria-labels';
import { personaDisplayName } from '../../personas/persona.registry';
import type { PersonaId } from '../../domain/types/persona';
import { PERSONA_IDS } from '../../domain/types/persona';

type ProviderSlot = {
  id: ProviderId;
  label: string;
  placeholder: string;
  hint: string;
};

type ProviderOption = { label: string; value: ProviderId };

/**
 * E6-S2 settings modal + E6-S3 auto-open extension. Renders:
 *   1. Persona → provider routing (user can send both personas to the same
 *      provider, e.g. use one Gemini key for both).
 *   2. One key slot per provider so both keys can be configured in a single
 *      visit; keys persist independently, saving does not close the dialog.
 *
 * `closedWithSave` fires on each save so the caller (chat component) can
 * re-dispatch a queued message; the dialog itself stays open until the user
 * hits Done / X / Esc so they can continue editing routing or the other key.
 */
@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [Dialog, Select, InputText, Button, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-modal.component.html',
  styleUrls: ['./settings-modal.component.scss'],
})
export class SettingsModalComponent {
  readonly open = model<boolean>(false);
  readonly autoOpenMode = model<boolean>(false);
  readonly closedWithSave = output<void>();
  readonly closedWithoutSave = output<void>();

  private readonly keyVault = inject(KeyVaultService);
  private readonly personaRouting = inject(PersonaRoutingService);
  private readonly modelSelection = inject(ModelSelectionService);
  private readonly modelDiscovery = inject(ModelDiscoveryService);
  private readonly analytics = inject(ANALYTICS_PORT);

  readonly title = PRODUCT_COPY.settingsTitle;
  readonly saveLabel = PRODUCT_COPY.saveButtonLabel;
  readonly clearLabel = PRODUCT_COPY.clearButtonLabel;
  readonly savedToast = PRODUCT_COPY.keySavedToast;
  readonly autoOpenHeader = PRODUCT_COPY.settingsAutoOpenHeader;
  readonly modalDismissLabel = modalDismissLabel;

  readonly justSaved = signal(false);
  readonly toastMessage = signal<string>(PRODUCT_COPY.keySavedToast);
  private savedDuringSession = false;

  readonly personas: PersonaId[] = [...PERSONA_IDS];
  readonly routing = this.personaRouting.routing;
  readonly selectedModel = this.modelSelection.selection;
  readonly discoveryState = this.modelDiscovery.state;

  readonly inputs = signal<Record<ProviderId, string>>({
    gemini: '',
    groq: '',
  });
  readonly revealed = signal<Record<ProviderId, boolean>>({
    gemini: false,
    groq: false,
  });

  readonly providerOptions: ProviderOption[] = [
    { label: 'Gemini', value: 'gemini' },
    { label: 'Groq', value: 'groq' },
  ];

  readonly slots: ProviderSlot[] = (['gemini', 'groq'] as ProviderId[]).map(
    (id) => ({
      id,
      label: id === 'gemini' ? 'Gemini' : 'Groq',
      placeholder: id === 'gemini' ? 'AIzaSy…' : 'gsk_…',
      hint: PRODUCT_COPY.keyFormatHelper(id),
    }),
  );

  readonly hasAnyKey = computed(() => this.keyVault.hasKey());

  constructor() {
    // Reset input drafts + reveal flags (but keep saved keys) whenever the
    // modal opens so the field is fresh. Force-refresh live models on every
    // open so the dropdowns never show stale entries — the static baseline
    // renders instantly and the live list swaps in once the fetch resolves.
    //
    // CRITICAL: `refreshAll` synchronously reads _state inside the discovery
    // service before its first await, and each successful fetch writes
    // _state. Without `untracked`, those reads become effect deps and the
    // subsequent writes retrigger the effect — an unbounded fetch loop.
    effect(() => {
      if (this.open()) {
        this.inputs.set({ gemini: '', groq: '' });
        this.revealed.set({ gemini: false, groq: false });
        this.savedDuringSession = false;
        untracked(() => {
          void this.modelDiscovery.refreshAll(true);
        });
      }
    });
  }

  personaLabel(p: PersonaId): string {
    return personaDisplayName(p);
  }

  isSaved(id: ProviderId): boolean {
    this.keyVault.revision();
    return this.keyVault.getKeyForProvider(id) !== null;
  }

  /** Saved key or a non-empty draft in the input field. */
  canRefreshModels(id: ProviderId): boolean {
    return this.isSaved(id) || !!(this.inputs()[id]?.trim());
  }

  slotStatus(id: ProviderId): string {
    return this.isSaved(id) ? 'Saved' : 'Not saved';
  }

  setInput(id: ProviderId, value: string): void {
    this.inputs.update((prev) => ({ ...prev, [id]: value }));
  }

  toggleReveal(id: ProviderId): void {
    this.revealed.update((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  setRoute(persona: PersonaId, provider: ProviderId): void {
    this.personaRouting.setProviderFor(persona, provider);
    this.flashToast(
      `${personaDisplayName(persona)} routed to ${provider === 'gemini' ? 'Gemini' : 'Groq'}`,
    );
  }

  setModel(provider: ProviderId, modelId: string): void {
    this.modelSelection.setModelFor(provider, modelId);
    const label =
      AVAILABLE_MODELS[provider].find((m) => m.id === modelId)?.label ??
      modelId;
    this.flashToast(`Model set to ${label}`);
  }

  private flashToast(message: string): void {
    this.toastMessage.set(message);
    this.justSaved.set(true);
    setTimeout(() => this.justSaved.set(false), 1800);
  }

  onRefreshModels(provider: ProviderId): void {
    const draft = this.inputs()[provider]?.trim();
    const keyOverride = !this.isSaved(provider) ? draft : undefined;
    if (!this.isSaved(provider) && !draft) return;
    void this.modelDiscovery.refresh(provider, /* force */ true, keyOverride);
  }

  discoveryLoading(provider: ProviderId): boolean {
    return this.discoveryState()[provider].loading;
  }

  discoveryError(provider: ProviderId): string | null {
    return this.discoveryState()[provider].error;
  }

  isLive(provider: ProviderId): boolean {
    const live = this.discoveryState()[provider].models;
    return live !== null && live.length > 0;
  }

  private modelsFor(provider: ProviderId) {
    const live = this.discoveryState()[provider].models;
    // Same guard as ModelDiscoveryService.getModelsFor — treat an empty
    // live array as "fetch happened but nothing usable" and fall back to
    // the curated static list rather than surfacing a blank dropdown.
    return live && live.length > 0 ? live : AVAILABLE_MODELS[provider];
  }

  modelOptionsFor(
    provider: ProviderId,
  ): { label: string; value: string }[] {
    return this.modelsFor(provider).map((m) => ({
      label: m.label,
      value: m.id,
    }));
  }

  modelHintFor(provider: ProviderId): string | null {
    const current = this.selectedModel()[provider];
    return this.modelsFor(provider).find((m) => m.id === current)?.hint ??
      null;
  }

  onSave(id: ProviderId): void {
    const key = (this.inputs()[id] ?? '').trim();
    if (!key) return;
    this.keyVault.setKey(id, key);
    this.analytics.emit({
      name: 'byo_key_saved',
      payload: { provider: id },
    });
    this.setInput(id, '');
    this.flashToast(PRODUCT_COPY.keySavedToast);
    this.savedDuringSession = true;
    void this.modelDiscovery.refresh(id, true);
    // Notify the caller so a queued message can re-dispatch. We deliberately
    // do NOT close the dialog — user may want to configure the other key or
    // change routing.
    this.closedWithSave.emit();
    this.autoOpenMode.set(false);
  }

  onClear(id: ProviderId): void {
    this.keyVault.clearKey(id);
    this.modelDiscovery.clear(id);
  }

  onDone(): void {
    this.open.set(false);
  }

  onHide(): void {
    // Fires on ANY close — X, Esc, mask-click, or Done button. Only treat as
    // dismissed-without-save when nothing was saved during this open session
    // (auto-open flow uses this to route back to landing).
    if (!this.savedDuringSession) this.closedWithoutSave.emit();
    this.autoOpenMode.set(false);
    this.savedDuringSession = false;
  }
}
