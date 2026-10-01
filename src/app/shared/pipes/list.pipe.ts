import { Pipe, PipeTransform } from '@angular/core';
import { parseList } from '../../core/utils/list';

/** `'{Rock,Blues}' | list` → ['Rock', 'Blues']; also handles plain comma-joined text. */
@Pipe({ name: 'list', standalone: true })
export class ListPipe implements PipeTransform {
  transform(value: string | null | undefined): string[] {
    return parseList(value);
  }
}
