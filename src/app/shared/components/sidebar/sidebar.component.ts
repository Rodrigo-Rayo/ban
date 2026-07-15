import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { IconComponent } from '../icon/icon.component';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit {
  auth   = inject(AuthService);
  router = inject(Router);
  private destroyRef = inject(DestroyRef);

  currentUrl = signal(this.router.url);

  filterQuery = signal('');
  filterCity  = signal('Toda España');
  filterGenre = signal('');

  readonly cities = ['Toda España', 'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao'];
  readonly genres = ['Rock', 'Jazz', 'Flamenco', 'Electrónica', 'Pop', 'Metal', 'Indie', 'Blues', 'Folk'];
  readonly instruments = ['Guitarra', 'Bajo', 'Batería', 'Teclados', 'Voz', 'Violín', 'Trompeta', 'Saxofón', 'Piano', 'Percusión', 'Otro'];
  filterInstrument = signal('');
  publishOpen = false;

  ngOnInit() {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe((e: any) => { this.currentUrl.set(e.urlAfterRedirects); this.publishOpen = false; });
  }

  get isSearch()    { return this.currentUrl().startsWith('/search'); }
  get isHome()      { return this.currentUrl() === '/home'; }
  get isInbox()     { return this.currentUrl().startsWith('/inbox'); }
  get isDashboard()     { return this.currentUrl().startsWith('/dashboard'); }
  get isFavorites()     { return this.currentUrl().startsWith('/favorites'); }
  get isNotifications() { return this.currentUrl().startsWith('/notifications'); }
  get isFeed()          { return this.currentUrl().startsWith('/feed'); }
  get isShop()          { return this.currentUrl().startsWith('/shop'); }


  get showInstrumentFilter() {
    return this.isSearch && (this.currentTab === 'musicians' || this.currentTab === 'teachers');
  }

  isActive(tab: string) { return this.currentUrl().includes(`tab=${tab}`); }

  get currentTab(): string {
    const m = this.currentUrl().match(/[?&]tab=([^&]+)/);
    return m ? m[1] : 'musicians';
  }

  get hasFilter() {
    return this.filterQuery() || this.filterGenre() || this.filterCity() !== 'Toda España' || this.filterInstrument();
  }

  goTab(tab: string) {
    this.filterInstrument.set('');
    this.router.navigate(['/search'], { queryParams: this.buildParams(tab) });
  }

  applyFilter() {
    this.router.navigate(['/search'], { queryParams: this.buildParams(this.currentTab) });
  }

  clearFilter() {
    this.filterQuery.set('');
    this.filterCity.set('Toda España');
    this.filterGenre.set('');
    this.filterInstrument.set('');
    this.router.navigate(['/search'], { queryParams: { tab: this.currentTab } });
  }

  private buildParams(tab: string): Record<string, string> {
    const p: Record<string, string> = { tab };
    if (this.filterCity() !== 'Toda España') p['city']       = this.filterCity();
    if (this.filterGenre())                  p['genre']      = this.filterGenre();
    if (this.filterQuery())                  p['q']          = this.filterQuery();
    if (this.filterInstrument())             p['instrument'] = this.filterInstrument();
    return p;
  }
}
