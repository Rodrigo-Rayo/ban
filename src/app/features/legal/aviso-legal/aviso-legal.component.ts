import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';
import { LEGAL_INFO } from '../legal-info';

@Component({
  selector: 'app-aviso-legal',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './aviso-legal.component.html',
})
export class AvisoLegalComponent implements OnInit {
  private seo = inject(SeoService);

  readonly info = LEGAL_INFO;

  ngOnInit() {
    this.seo.set({
      title: 'Aviso Legal',
      description: 'Aviso legal de BandYou: datos identificativos del titular conforme a la LSSI-CE.',
      url: 'https://bandyou.es/legal/aviso-legal',
    });
  }
}
