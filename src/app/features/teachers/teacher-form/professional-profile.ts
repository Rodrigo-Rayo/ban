import { AuthService } from '../../../core/services/auth.service';
import { ConfirmService } from '../../../core/services/confirm.service';

export type ProfessionalProfileType = 'teacher' | 'rehearsal' | 'venue';

const TYPE_LABELS: Record<string, string> = {
  musician: 'de músico',
  band: 'de banda',
  venue: 'de sala',
  teacher: 'de profesor',
  rehearsal: 'de local de ensayo',
};

/**
 * Creating a professional profile when the user already has a profile of ANOTHER type
 * ends up with two profiles on one account. Ask first so it is never silent.
 * Resolves true when it is fine to continue.
 */
export async function confirmSecondProfile(
  auth: AuthService,
  confirm: ConfirmService,
  ownType: ProfessionalProfileType,
  isEditing: boolean,
): Promise<boolean> {
  const existing = auth.userProfileType();
  if (isEditing || !existing || existing === ownType) return true;
  return confirm.ask({
    title: 'Ya tienes un perfil ' + (TYPE_LABELS[existing] ?? ''),
    message: 'Si continúas, tu cuenta tendrá un segundo perfil profesional además del que ya tienes. ¿Quieres crearlo?',
    confirmLabel: 'Crear segundo perfil',
    cancelLabel: 'Cancelar',
  });
}
