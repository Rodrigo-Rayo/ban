import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './landing.component.html',
})
export class LandingComponent {
  catalog = [
    { tab: 'musicians', label: 'Músicos',    icon: 'music',      desc: 'Guitarras, bajos, voces y más' },
    { tab: 'bands',     label: 'Bandas',     icon: 'mic',        desc: 'Buscan miembros o proyectos' },
    { tab: 'venues',    label: 'Salas',      icon: 'building',   desc: 'Conciertos y eventos en directo' },
    { tab: 'teachers',  label: 'Profesores', icon: 'book-open',  desc: 'Clases particulares y talleres' },
    { tab: 'events',    label: 'Agenda',     icon: 'calendar',   desc: 'Bolos, jams, open stages' },
  ];

  steps = [
    { n: '01', title: 'Crea tu perfil',       desc: 'Instrumento, estilos, zona y disponibilidad. Cinco minutos.' },
    { n: '02', title: 'Explora el directorio', desc: 'Filtra por ciudad, género, instrumento y nivel.' },
    { n: '03', title: 'Escribe directamente',  desc: 'Sin matches, sin swipes. Ves un perfil y escribes.' },
    { n: '04', title: 'Toca',                  desc: 'Sala de ensayo, estudio, concierto — todo coordinado.' },
  ];
}
