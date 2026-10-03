import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { TeacherProfileComponent } from './teacher-profile.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MessagesService } from '../../../core/services/messages.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { Teacher } from '../../../core/models';

const teacher = { id: 't-1', user_id: 'teacher-1', name: 'Marta Profe', instrument: 'Piano', city: 'Madrid' } as unknown as Teacher;

describe('TeacherProfileComponent — lesson request', () => {
  let component: TeacherProfileComponent;
  let notifSpy: jasmine.SpyObj<NotificationsService>;
  let messagesSpy: jasmine.SpyObj<MessagesService>;
  let toastSpy: jasmine.SpyObj<ToastService>;
  let rpc: jasmine.Spy;

  beforeEach(async () => {
    rpc = jasmine.createSpy('rpc').and.returnValue(Promise.resolve({ data: 'Lola García', error: null }));
    notifSpy = jasmine.createSpyObj<NotificationsService>('NotificationsService', ['create']);
    notifSpy.create.and.returnValue(Promise.resolve());
    messagesSpy = jasmine.createSpyObj<MessagesService>('MessagesService', ['getOrCreateConversation', 'sendMessage']);
    messagesSpy.getOrCreateConversation.and.returnValue(Promise.resolve({ id: 'c-1' } as any));
    messagesSpy.sendMessage.and.returnValue(Promise.resolve() as any);
    toastSpy = jasmine.createSpyObj<ToastService>('ToastService', ['error', 'success']);

    await TestBed.configureTestingModule({
      imports: [TeacherProfileComponent],
      providers: [
        { provide: SupabaseService, useValue: { auth: {}, client: { rpc } } },
        { provide: MessagesService, useValue: messagesSpy },
        { provide: FavoritesService, useValue: jasmine.createSpyObj('FavoritesService', ['isFavorite', 'toggle']) },
        { provide: NotificationsService, useValue: notifSpy },
        { provide: SeoService, useValue: jasmine.createSpyObj('SeoService', ['setProfile', 'injectJsonLd', 'setNotFound']) },
        { provide: ToastService, useValue: toastSpy },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 't-1' } } } },
      ],
    })
    .overrideComponent(TeacherProfileComponent, { set: { imports: [], template: '<div></div>' } })
    .compileComponents();

    component = TestBed.createComponent(TeacherProfileComponent).componentInstance;
    component.teacher.set(teacher);
    component.currentUserId.set('student-1');
    component.bookingDate = '2026-10-06';
  });

  const settle = () => new Promise(r => setTimeout(r));

  it('notifies the teacher with a booking after the request is sent', async () => {
    await component.submitBooking();
    await settle();
    expect(messagesSpy.sendMessage).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('get_profile_name', { p_user_id: 'student-1' });
    expect(notifSpy.create).toHaveBeenCalledOnceWith(
      'teacher-1', 'booking', 'Nueva solicitud de clase',
      jasmine.stringMatching(/^Lola García quiere una clase el .+6 de octubre de 2026\. Tienes los detalles en tus mensajes\.$/),
      'teacher', 't-1');
    expect(component.bookingSuccess()).toBeTrue();
  });

  it('does not notify when the message could not be sent', async () => {
    messagesSpy.sendMessage.and.returnValue(Promise.reject(new Error('x')));
    await component.submitBooking();
    await settle();
    expect(notifSpy.create).not.toHaveBeenCalled();
    expect(toastSpy.error).toHaveBeenCalled();
  });

  it('never notifies the teacher about their own request', async () => {
    component.currentUserId.set('teacher-1');
    await component.submitBooking();
    await settle();
    expect(notifSpy.create).not.toHaveBeenCalled();
  });

  it('keeps the request as sent when the notification fails', async () => {
    notifSpy.create.and.returnValue(Promise.reject(new Error('rate limit')));
    await component.submitBooking();
    await settle();
    expect(component.bookingSuccess()).toBeTrue();
    expect(toastSpy.error).not.toHaveBeenCalled();
  });
});
