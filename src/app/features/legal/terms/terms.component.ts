import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './terms.component.html',
})
export class TermsComponent implements OnInit {
  private seo = inject(SeoService);

  readonly updated = '13 de julio de 2026';

  ngOnInit() {
    this.seo.set({
      title: 'Términos de Uso',
      description: 'Términos y condiciones de uso de BandYou, la red musical de España.',
      url: 'https://bandyou.es/legal/terminos',
    });
  }
}
