import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { ProfileContactComponent, whatsappLink } from './profile-contact.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import { MediaFeaturesService } from '../../../core/services/media-features.service';

describe('whatsappLink', () => {
  it('links Spanish mobiles in any common format', () => {
    expect(whatsappLink('612 345 678')).toBe('https://wa.me/34612345678');
    expect(whatsappLink('+34 712-345-678')).toBe('https://wa.me/34712345678');
  });

  it('ignores landlines, short numbers and empty values', () => {
    expect(whatsappLink('954 123 456')).toBeNull();
    expect(whatsappLink('612')).toBeNull();
    expect(whatsappLink(null)).toBeNull();
  });
});

describe('ProfileContactComponent', () => {
  let selects: string[];

  async function render(loggedIn: boolean, row: object, migrated = true) {
    selects = [];
    const builder: any = {
      select: (cols: string) => { selects.push(cols); return builder; },
      eq: () => builder,
      maybeSingle: () => Promise.resolve({ data: row, error: null }),
    };
    TestBed.configureTestingModule({
      imports: [ProfileContactComponent],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: { client: { from: () => builder } } },
        { provide: AuthService, useValue: { isLoggedIn: signal(loggedIn) } },
        { provide: MediaFeaturesService, useValue: { has: () => Promise.resolve(migrated) } },
      ],
    });
    const fixture = TestBed.createComponent(ProfileContactComponent);
    fixture.componentRef.setInput('table', 'musicians');
    fixture.componentRef.setInput('profileId', 'm1');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows email, phone and WhatsApp to signed-in users', async () => {
    const el = await render(true, { contact_email: 'ana@x.es', phone: '612345678' });
    expect(el.textContent).toContain('ana@x.es');
    expect(el.querySelector('a[href="tel:612345678"]')).not.toBeNull();
    expect(el.querySelector('a[href="https://wa.me/34612345678"]')).not.toBeNull();
  });

  it('never asks anonymous visitors for the contact columns, only has_contact', async () => {
    const el = await render(false, { has_contact: true });
    expect(selects).toEqual(['has_contact']);
    expect(el.textContent).toContain('Inicia sesión para ver el email y el teléfono');
  });

  it('shows nothing to visitors when the profile has no contact', async () => {
    const el = await render(false, { has_contact: false });
    expect(el.textContent?.trim()).toBe('');
  });

  it('before the SQL runs, reads only the email on tables without a phone column', async () => {
    await render(true, { contact_email: 'a@b.es' }, false);
    expect(selects).toEqual(['contact_email']);
  });
});
