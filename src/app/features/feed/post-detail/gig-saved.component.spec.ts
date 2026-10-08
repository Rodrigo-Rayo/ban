import { saverCandidates } from './gig-saved.component';

describe('saverCandidates', () => {
  it('lists the other person of each conversation once, keeping the order', () => {
    const rows = [
      { user1_id: 'me', user2_id: 'a', user1_name: 'Yo', user2_name: 'Ana' },
      { user1_id: 'b', user2_id: 'me', user1_name: ' Bea ', user2_name: 'Yo' },
      { user1_id: 'a', user2_id: 'me', user1_name: 'Ana', user2_name: 'Yo' },
      { user1_id: 'me', user2_id: 'c', user1_name: 'Yo', user2_name: null },
    ];
    expect(saverCandidates(rows, 'me')).toEqual([
      { userId: 'a', name: 'Ana' }, { userId: 'b', name: 'Bea' }, { userId: 'c', name: 'Sin nombre' },
    ]);
  });
});
