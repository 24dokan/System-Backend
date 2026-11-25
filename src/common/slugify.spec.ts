import { slugify } from './slugify';

describe('slugify', () => {
  it('lowercases and hyphenates', () => expect(slugify('Great Wall Hair!')).toBe('great-wall-hair'));
  it('falls back when empty', () => expect(slugify('***')).toBe('brand'));
});
