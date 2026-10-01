import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';
import { LEGAL_INFO } from '../legal-info';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './privacy.component.html',
})
export class PrivacyComponent implements OnInit {
  private seo = inject(SeoService);

  readonly info = LEGAL_INFO;

  ngOnInit() {
    this.seo.set({
      title: 'Política de Privacidad',
      description: 'Política de privacidad de BandYou. Cómo recogemos, usamos y protegemos tus datos personales.',
      url: 'https://bandyou.es/legal/privacidad',
    });
  }
}
