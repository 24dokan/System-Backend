import { REQUIRED_FIELDS, maskTail, missingFields } from './profile.rules';

describe('missingFields', () => {
  const full = Object.fromEntries(REQUIRED_FIELDS.map(([k]) => [k, 'x']));
  it('lists every required field for a missing profile', () => expect(missingFields(null)).toHaveLength(REQUIRED_FIELDS.length));
  it('is empty for a complete profile', () => expect(missingFields({ ...full, womanOwned: false, malaysianOwned: true, stockedInMalaysia: false })).toEqual([]));
  it('treats blank text as missing but false as filled in', () => {
    expect(missingFields({ ...full, legalName: '  ' })).toEqual(['Company legal name']);
    expect(missingFields({ ...full, womanOwned: false })).toEqual([]);
  });
  it('does not require optional fields', () => expect(missingFields({ ...full, sstNumber: null, bankAddress: null })).toEqual([]));
});

describe('maskTail', () => {
  it('keeps only the last 4 characters', () => expect(maskTail('980701055044')).toBe('••••••••5044'));
  it('reveals less of short values', () => expect(maskTail('1234')).toBe('••••4'));
  it('returns null for empty', () => expect(maskTail(null)).toBeNull());
});
