import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';

import { PRODUCT_COPY } from '../../config/product-copy';
import { modalDismissLabel } from '../../config/aria-labels';
import {
  CustomPersonaGeneratorService,
  CustomPersonaGenerationError,
} from '../../domain/custom-persona/custom-persona-generator.service';
import { KeyVaultService } from '../../domain/key-vault/key-vault.service';
import { AppSettingsService } from '../../shared/app-settings/app-settings.service';

@Component({
  selector: 'app-create-persona-dialog',
  standalone: true,
  imports: [Dialog, Button, InputText, Textarea, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './create-persona-dialog.component.html',
  styleUrls: ['./create-persona-dialog.component.scss'],
})
export class CreatePersonaDialogComponent {
  private readonly generator = inject(CustomPersonaGeneratorService);
  private readonly keyVault = inject(KeyVaultService);
  private readonly appSettings = inject(AppSettingsService);
  private readonly router = inject(Router);

  readonly open = model<boolean>(false);
  readonly created = output<void>();

  readonly title = PRODUCT_COPY.createPersonaDialogTitle;
  readonly subtitle = PRODUCT_COPY.createPersonaDialogSubtitle;
  readonly nameLabel = PRODUCT_COPY.createPersonaNameLabel;
  readonly detailsLabel = PRODUCT_COPY.createPersonaDetailsLabel;
  readonly createLabel = PRODUCT_COPY.createPersonaCreateLabel;
  readonly cancelLabel = PRODUCT_COPY.createPersonaCancelLabel;
  readonly noKeyMessage = PRODUCT_COPY.createPersonaNoKeyMessage;
  readonly addKeyLabel = PRODUCT_COPY.createPersonaAddKeyButtonLabel;
  readonly modalDismissLabel = modalDismissLabel;

  readonly name = signal('');
  readonly details = signal('');
  readonly generating = signal(false);
  readonly error = signal<string | null>(null);

  readonly needsKey = computed(() => !this.keyVault.hasKey());

  readonly canGenerate = computed(
    () => this.name().trim().length > 0 && !this.generating() && !this.needsKey(),
  );

  onHide(): void {
    if (!this.generating()) {
      this.name.set('');
      this.details.set('');
      this.error.set(null);
    }
  }

  onCancel(): void {
    if (this.generating()) return;
    this.open.set(false);
  }

  openSettings(): void {
    this.error.set(this.noKeyMessage);
    this.appSettings.openSettings({ auto: true });
  }

  async onGenerate(): Promise<void> {
    const trimmedName = this.name().trim();
    if (!trimmedName || this.generating()) return;

    if (!this.keyVault.hasKey()) {
      this.error.set(this.noKeyMessage);
      this.appSettings.openSettings({ auto: true });
      return;
    }

    this.generating.set(true);
    this.error.set(null);

    try {
      const record = await this.generator.generate(
        trimmedName,
        this.details().trim() || undefined,
      );
      this.open.set(false);
      this.name.set('');
      this.details.set('');
      this.created.emit();
      const urlId = record.id.replace(/^custom:/, '');
      await this.router.navigate(['/chat', 'custom', urlId]);
    } catch (err) {
      if (err instanceof CustomPersonaGenerationError) {
        if (err.code === 'no_key') {
          this.error.set(this.noKeyMessage);
          this.appSettings.openSettings({ auto: true });
          return;
        }
        this.error.set(PRODUCT_COPY.createPersonaErrorGeneric);
      } else {
        this.error.set(PRODUCT_COPY.createPersonaErrorGeneric);
      }
    } finally {
      this.generating.set(false);
    }
  }
}
