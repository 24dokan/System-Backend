import { checkSeo, suggestSeo, uniqueSlug } from './seo.rules';

describe('seo rules', () => {
  it('suggests defaults from the product', () => {
    const s = suggestSeo('Hydrating Face Cream 50ml', 'x '.repeat(200), 'Nur Beauty');
    expect(s.slug).toBe('hydrating-face-cream-50ml');
    expect(s.metaTitle).toBe('Hydrating Face Cream 50ml | Nur Beauty');
    expect(s.metaDescription.length).toBeLessThanOrEqual(160);
  });
  it('checks limits', () => {
    expect(checkSeo({ slug: 'Bad Slug' })).toMatch(/lowercase/);
    expect(checkSeo({ slug: 'good-slug', metaTitle: 'a'.repeat(71) })).toMatch(/70/);
    expect(checkSeo({ slug: 'good-slug', metaDescription: 'ok' })).toBeNull();
  });
  it('makes slugs unique', () => {
    const taken = new Set(['a', 'a-2']);
    expect(uniqueSlug('a', (s) => taken.has(s))).toBe('a-3');
    expect(uniqueSlug('b', (s) => taken.has(s))).toBe('b');
  });
});
