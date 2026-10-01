import { Component, inject, signal, OnInit, DestroyRef, HostListener } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { IconComponent } from '../icon/icon.component';
import { GENRES, INSTRUMENTS } from '../../../core/constants/music.constants';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
    selector: 'app-sidebar',
    imports: [RouterLink, IconComponent],
    templateUrl: './sidebar.component.html'
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
  readonly genres = GENRES;
  readonly instruments = INSTRUMENTS;
  filterInstrument = signal('');
  publishOpen = false;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.publishOpen && !(event.target as Element).closest('[data-publish-dropdown]')) {
      this.publishOpen = false;
    }
  }

  ngOnInit() {
    this.syncFiltersFromUrl(this.router.url);
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe((e: NavigationEnd) => {
        this.currentUrl.set(e.urlAfterRedirects);
        this.publishOpen = false;
        this.syncFiltersFromUrl(e.urlAfterRedirects);
      });
  }

  /** The URL is the source of truth for search filters (reloads, shared links, page-level filters). */
  private syncFiltersFromUrl(url: string) {
    if (!url.startsWith('/search')) return;
    const q = this.router.parseUrl(url).queryParams;
    this.filterQuery.set(q['q'] ?? '');
    this.filterCity.set(q['city'] ?? 'Toda España');
    this.filterGenre.set(q['genre'] ?? '');
    this.filterInstrument.set(q['instrument'] ?? '');
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
