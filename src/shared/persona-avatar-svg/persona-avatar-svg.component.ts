import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

@Component({
  selector: 'app-persona-avatar-svg',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.viewBox]="'0 0 ' + size() + ' ' + size()"
      role="img"
      [attr.aria-label]="displayName() + ' avatar'"
    >
      <circle
        [attr.cx]="size() / 2"
        [attr.cy]="size() / 2"
        [attr.r]="size() / 2"
        [attr.fill]="accent()"
      />
      <text
        [attr.x]="size() / 2"
        [attr.y]="size() / 2"
        text-anchor="middle"
        dominant-baseline="central"
        [attr.font-size]="fontSize()"
        font-weight="600"
        fill="#ffffff"
        font-family="system-ui, sans-serif"
      >
        {{ initials() }}
      </text>
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
      border-radius: 50%;
      overflow: hidden;
    }
    svg {
      display: block;
    }
  `,
})
export class PersonaAvatarSvgComponent {
  readonly displayName = input.required<string>();
  readonly size = input(96);

  readonly initials = computed(() => initialsFromName(this.displayName()));

  readonly accent = computed(() => {
    const hues = [210, 260, 320, 30, 160, 200, 280];
    const idx = hashString(this.displayName()) % hues.length;
    return `hsl(${hues[idx]} 55% 42%)`;
  });

  readonly fontSize = computed(() => Math.round(this.size() * 0.34));
}
