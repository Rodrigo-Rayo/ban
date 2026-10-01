import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';
import { LEGAL_INFO } from '../legal-info';

@Component({
    selector: 'app-terms',
    imports: [RouterLink],
    templateUrl: './terms.component.html'
})
export class TermsComponent implements OnInit {
  private seo = inject(SeoService);

  readonly info = LEGAL_INFO;

  ngOnInit() {
    this.seo.set({
      title: 'Términos de Uso',
      description: 'Términos y condiciones de uso de BandYou, la red musical de España.',
      url: 'https://bandyou.es/legal/terminos',
    });
  }
}
