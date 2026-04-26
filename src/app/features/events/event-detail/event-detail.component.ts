import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [RouterLink, CommonModule, DatePipe],
  template: `
    <div class="min-h-screen bg-dark-900" style="padding-top:64px; padding-bottom:64px">

      <!-- Back nav -->
      <div class="px-6 lg:px-10 py-3.5 border-b border-dark-600 bg-dark-800/50">
        <a [routerLink]="['/search']" [queryParams]="{tab:'events'}"
           class="inline-flex items-center gap-2 text-xs font-medium text-ink-muted hover:text-ink transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          Volver a la agenda
        </a>
      </div>

      @if (loading()) {
        <div class="flex items-center justify-center py-20">
          <div class="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      } @else if (!event()) {
        <div class="text-center py-20 px-6">
          <h2 class="text-xl font-bold text-ink mb-2">Evento no encontrado.</h2>
          <a [routerLink]="['/search']" [queryParams]="{tab:'events'}" class="btn-accent text-sm mt-4 inline-flex">Ver agenda</a>
        </div>
      } @else {
        <div class="px-6 lg:px-10 py-8 max-w-3xl mx-auto">

          <!-- Hero card -->
          <div class="card-flat overflow-hidden mb-6 flex">
            <!-- Date block -->
            <div class="w-28 flex flex-col items-center justify-center p-5 bg-primary-600 flex-shrink-0">
              <span class="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">{{ event()!.date | date:'EEE' | uppercase }}</span>
              <span class="text-5xl font-black text-white leading-none">{{ event()!.date | date:'d' }}</span>
              <span class="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-1">{{ event()!.date | date:'MMM' | uppercase }}</span>
              @if (event()!.time) {
                <span class="text-xs font-medium text-white mt-3 pt-3 border-t border-white/20 w-full text-center">{{ event()!.time?.slice(0,5) }}h</span>
              }
            </div>
            <!-- Info -->
            <div class="p-6 flex-1 min-w-0">
              <div class="flex flex-wrap gap-2 mb-3">
                @if (event()!.genre) { <span class="tag">{{ event()!.genre }}</span> }
                @if (event()!.price) { <span class="tag-accent">{{ event()!.price }}</span> }
              </div>
              <h1 class="text-2xl font-bold text-ink leading-tight mb-2">{{ event()!.title }}</h1>
              <div class="text-sm text-ink-muted">
                {{ event()!.venue }}@if (event()!.city) { · {{ event()!.city }} }
              </div>
            </div>
          </div>

          <!-- Description -->
          @if (event()!.description) {
            <div class="card-flat p-5 mb-6">
              <h3 class="text-xs font-bold text-ink-3 uppercase tracking-widest mb-3">Sobre el evento</h3>
              <p class="text-sm text-ink-3 leading-relaxed">{{ event()!.description }}</p>
            </div>
          }

          <!-- Actions -->
          <div class="flex gap-3 flex-wrap">
            @if (event()!.ticket_url) {
              <a [href]="event()!.ticket_url" target="_blank" class="btn-accent px-6 py-3 text-sm">Comprar entradas</a>
            }
            @if (event()!.contact_email) {
              <a [href]="'mailto:' + event()!.contact_email" class="btn-secondary px-6 py-3 text-sm">Contactar organizador</a>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class EventDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private supabase = inject(SupabaseService);

  event = signal<any>(null);
  loading = signal(true);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    const { data } = await this.supabase.client
      .from('events')
      .select('*')
      .eq('id', id)
      .single();
    this.event.set(data);
    this.loading.set(false);
  }
}
