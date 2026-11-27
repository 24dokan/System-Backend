import { slugify } from '../common/slugify';

export const META_TITLE_MAX = 70;
export const META_DESCRIPTION_MAX = 160;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const clip = (s: string, max: number) => {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > max * 0.6 ? cut.lastIndexOf(' ') : cut.length).trim()}…`;
};

/** Defaults shown to the seller when they have not written their own. */
export function suggestSeo(name: string, description?: string | null, brand?: string) {
  return {
    slug: slugify(name).slice(0, 80),
    metaTitle: clip(brand ? `${name} | ${brand}` : name, META_TITLE_MAX),
    metaDescription: clip(description || name, META_DESCRIPTION_MAX),
  };
}

/** Returns an error message, or null when the details are fine. */
export function checkSeo(v: { slug?: string | null; metaTitle?: string | null; metaDescription?: string | null }): string | null {
  if (v.slug != null && v.slug !== '' && (!SLUG_PATTERN.test(v.slug) || v.slug.length > 80)) return 'The web address may only use lowercase letters, numbers and dashes (up to 80 characters)';
  if (v.metaTitle && v.metaTitle.length > META_TITLE_MAX) return `The page title can be at most ${META_TITLE_MAX} characters`;
  if (v.metaDescription && v.metaDescription.length > META_DESCRIPTION_MAX) return `The page description can be at most ${META_DESCRIPTION_MAX} characters`;
  return null;
}

/** Picks a slug nobody else has, adding -2, -3 ... when needed. */
export function uniqueSlug(base: string, taken: (s: string) => boolean): string {
  if (!taken(base)) return base;
  for (let i = 2; i < 1000; i++) if (!taken(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${Date.now()}`;
}
