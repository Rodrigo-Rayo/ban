import { planMemberSave } from './band-members';

describe('planMemberSave', () => {
  const saved = [
    { id: 'a', name: 'Carlos', instrument: 'Batería' },
    { id: 'b', name: 'Lu', instrument: 'Bajo' },
    { id: 'c', name: 'Pepa', instrument: 'Voz' },
  ];

  it('keeps unchanged rows untouched, so invite links survive a save', () => {
    const plan = planMemberSave(saved, saved.map(s => ({ ...s, linked: s.id === 'a' })));
    expect(plan).toEqual({ remove: [], update: [], insert: [] });
  });

  it('renames changed rows, adds new ones and deletes removed ones', () => {
    const plan = planMemberSave(saved, [
      { id: 'a', name: ' Carlos ', instrument: 'Batería' },
      { id: 'b', name: 'Lucía', instrument: 'Bajo' },
      { name: 'Nuevo', instrument: 'Guitarra' },
    ]);
    expect(plan.remove).toEqual(['c']);
    expect(plan.update).toEqual([{ id: 'b', name: 'Lucía', instrument: 'Bajo' }]);
    expect(plan.insert).toEqual([{ name: 'Nuevo', instrument: 'Guitarra' }]);
  });

  it('skips new rows without a name or instrument and never deletes a saved row left blank', () => {
    const plan = planMemberSave(saved, [
      { id: 'a', name: '  ', instrument: 'Batería' },
      { id: 'b', name: 'Lu', instrument: '' },
      { name: 'Sin instrumento', instrument: '' },
      { id: 'c', name: 'Pepa', instrument: 'Voz' },
    ]);
    expect(plan.remove).toEqual([]);
    expect(plan.update).toEqual([]);
    expect(plan.insert).toEqual([]);
  });

  it('treats an unknown id as a new row', () => {
    expect(planMemberSave([], [{ id: 'zz', name: 'X', instrument: 'Voz' }]).insert).toEqual([{ name: 'X', instrument: 'Voz' }]);
  });
});
