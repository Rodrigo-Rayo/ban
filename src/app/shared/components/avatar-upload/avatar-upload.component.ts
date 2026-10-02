import { Component, inject, input, output } from '@angular/core';
import { AvatarUploadService, AVATAR_ACCEPT } from '../../../core/services/avatar-upload.service';
import { IconComponent } from '../icon/icon.component';

/**
 * "Cambiar foto" button: opens the file picker directly (no wizard) and uploads
 * through AvatarUploadService. Style it with `variant`; emits the new URL.
 */
@Component({
  selector: 'app-avatar-upload',
  imports: [IconComponent],
  template: `
    <label [class]="classes()"
           [class.opacity-60]="svc.uploading()" [class.pointer-events-none]="svc.uploading()">
      <app-icon name="camera" [size]="16"/>
      <span>{{ svc.uploading() ? 'Subiendo…' : label() }}</span>
      <input type="file" class="sr-only" [accept]="accept" [attr.aria-label]="label()"
             (change)="onFile($event)" [disabled]="svc.uploading()">
    </label>
  `,
})
export class AvatarUploadComponent {
  readonly svc = inject(AvatarUploadService);
  readonly accept = AVATAR_ACCEPT;

  readonly label = input('Cambiar foto');
  readonly variant = input<'primary' | 'secondary' | 'night'>('secondary');
  readonly uploaded = output<string>();

  classes(): string {
    const base = { primary: 'btn-primary', secondary: 'btn-secondary', night: 'btn-night' }[this.variant()];
    return `${base} cursor-pointer min-h-[44px] focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2`;
  }

  async onFile(event: Event) {
    const inputEl = event.target as HTMLInputElement;
    const url = await this.svc.upload(inputEl.files?.[0]);
    inputEl.value = ''; // allow picking the same file again
    if (url) this.uploaded.emit(url);
  }
}
