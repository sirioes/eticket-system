import { Divisi } from '../../common/enums/divisi.enum';
import {
  DIVISI_LABEL,
  historyActionLabel,
  stageStatusLabel,
} from './ticket-export-labels';

const ticket = {
  fromDivisi: Divisi.YOUTUBE,
  toDivisi: Divisi.DIGITAL_MARKETING,
};

describe('ticket-export-labels', () => {
  it('memberi label terbaca untuk setiap divisi', () => {
    expect(Object.keys(DIVISI_LABEL).sort()).toEqual(
      Object.values(Divisi).sort(),
    );
    expect(DIVISI_LABEL.YOUTUBE).toBe('YouTube');
    expect(DIVISI_LABEL.DIGITAL_MARKETING).toBe('Digital Marketing');
    expect(DIVISI_LABEL.TAX).toBe('Pajak');
  });

  describe('stageStatusLabel', () => {
    it.each([
      ['MENUNGGU_MANAGER_ASAL', 'Menunggu Manajer Divisi YouTube'],
      ['MENUNGGU_MANAGER_TUJUAN', 'Menunggu Manajer Divisi Digital Marketing'],
      ['MENUNGGU_STAF_TUJUAN', 'Diterima'],
      ['DIPROSES', 'Diproses'],
      ['SELESAI', 'Selesai'],
      ['DITOLAK', 'Ditolak'],
    ] as const)('menerjemahkan %s', (stage, expected) => {
      expect(stageStatusLabel({ ...ticket, stage })).toBe(expected);
    });
  });

  describe('historyActionLabel', () => {
    it.each([
      ['DIBUAT', null, 'Dibuat'],
      ['TERIMA', 'MENUNGGU_MANAGER_ASAL', 'Disetujui Manajer Divisi YouTube'],
      [
        'TERIMA',
        'MENUNGGU_MANAGER_TUJUAN',
        'Diterima Manajer Divisi Digital Marketing',
      ],
      ['TOLAK', 'MENUNGGU_MANAGER_ASAL', 'Ditolak Manajer Divisi YouTube'],
      [
        'TOLAK',
        'MENUNGGU_MANAGER_TUJUAN',
        'Ditolak Manajer Divisi Digital Marketing',
      ],
      ['PROSES', 'MENUNGGU_STAF_TUJUAN', 'Mulai diproses'],
      ['SELESAI', 'DIPROSES', 'Diselesaikan'],
    ] as const)(
      'menerjemahkan %s dari tahap %s',
      (action, fromStage, expected) => {
        expect(historyActionLabel({ action, fromStage }, ticket)).toBe(
          expected,
        );
      },
    );
  });
});
