import { ShareResult } from './share-card';

/** Toast after "Imagen para historias": only the outcomes the user would otherwise not notice. */
export function storyFeedback(result: ShareResult, toast: { success(message: string): void }): void {
  if (result === 'downloaded') toast.success('Imagen guardada. Súbela a tus historias.');
  else if (result === 'blocked') toast.success('Imagen lista: toca otra vez el botón para compartirla.');
}
