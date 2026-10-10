import { startOfNextWitaDay, startOfWitaDay } from './wita-date-range';

describe('startOfWitaDay', () => {
  it('mengubah 00:00 WITA menjadi 16:00 UTC hari sebelumnya', () => {
    expect(startOfWitaDay('2026-10-08')).toEqual(
      new Date('2026-10-07T16:00:00.000Z'),
    );
  });

  it('melewati pergantian bulan dan tahun', () => {
    expect(startOfWitaDay('2026-01-01')).toEqual(
      new Date('2025-12-31T16:00:00.000Z'),
    );
    expect(startOfWitaDay('2026-03-01')).toEqual(
      new Date('2026-02-28T16:00:00.000Z'),
    );
  });

  it('menerima 29 Februari hanya di tahun kabisat', () => {
    expect(startOfWitaDay('2028-02-29')).toEqual(
      new Date('2028-02-28T16:00:00.000Z'),
    );
    expect(startOfWitaDay('2026-02-29')).toBeNull();
  });

  it.each([
    '2026-13-01',
    '2026-00-10',
    '2026-10-32',
    '2026-02-30',
    '2026-1-8',
    '08-10-2026',
    '2026-10-08T00:00:00Z',
    '0050-01-01',
    '',
    'kemarin',
  ])('mengembalikan null untuk "%s"', (value) => {
    expect(startOfWitaDay(value)).toBeNull();
  });
});

describe('startOfNextWitaDay', () => {
  it('memberi batas atas eksklusif berupa awal hari berikutnya', () => {
    expect(startOfNextWitaDay('2026-10-08')).toEqual(
      new Date('2026-10-08T16:00:00.000Z'),
    );
  });

  it('menyertakan tiket yang dibuat pukul 23:59 WITA pada hari itu', () => {
    const before = startOfNextWitaDay('2026-10-08') as Date;
    const lastMinute = new Date('2026-10-08T15:59:00.000Z');
    const firstMinuteNextDay = new Date('2026-10-08T16:00:00.000Z');

    expect(lastMinute < before).toBe(true);
    expect(firstMinuteNextDay < before).toBe(false);
  });

  it('melewati akhir bulan', () => {
    expect(startOfNextWitaDay('2026-10-31')).toEqual(
      new Date('2026-10-31T16:00:00.000Z'),
    );
  });

  it('mengembalikan null untuk tanggal tidak valid', () => {
    expect(startOfNextWitaDay('2026-02-30')).toBeNull();
  });
});
