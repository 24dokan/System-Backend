/** Fields a seller must fill in before they can submit products. The label is what the seller sees. */
export const REQUIRED_FIELDS = [
  ['contactFirstName', 'First name'], ['contactLastName', 'Last name'], ['idNumber', 'I.C./Passport no.'],
  ['contactEmail', 'Contact email'], ['contactPhone', 'Contact phone'],
  ['legalName', 'Company legal name'], ['companyAddress', 'Company address'], ['country', 'Country'], ['city', 'City'],
  ['postcode', 'Postcode'], ['womanOwned', 'Woman-owned business'], ['malaysianOwned', 'Malaysian-owned business'],
  ['bankName', 'Bank name'], ['bankAccountName', 'Bank account owner name'], ['bankAccountNumber', 'Bank account number'],
  ['stockedInMalaysia', 'Products stored in Malaysia'], ['cartSystem', 'Online shopping system used now'],
  ['tinNumber', 'Company TIN number'], ['einvoiceContactName', 'E-invoice contact person'], ['einvoiceEmail', 'E-invoice email'],
] as const;

export type ProfileField = (typeof REQUIRED_FIELDS)[number][0];

/** Labels of required fields that are still empty. Works with a missing profile too. */
export function missingFields(profile: Partial<Record<string, unknown>> | null | undefined): string[] {
  return REQUIRED_FIELDS.filter(([key]) => {
    const v = profile?.[key];
    return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
  }).map(([, label]) => label);
}

/** Shows only the last characters, for staff who may not see the full value. */
export function maskTail(value: string | null | undefined, keep = 4): string | null {
  if (!value) return null;
  const shown = Math.min(keep, Math.floor(value.length / 3)); // short values reveal less
  return `${'•'.repeat(Math.max(4, value.length - shown))}${shown ? value.slice(-shown) : ''}`;
}

/** Choices shown in drop-downs. Placeholders until the business confirms the real lists. */
export const PROFILE_OPTIONS = {
  sellerTypes: ['Brand owner', 'Wholesale Seller', 'Retailer', 'Distributor', 'Manufacturer'],
  cartSystems: ['None', 'EasyStore', 'Shopify', 'WooCommerce', 'Wix', 'Other'],
  titles: ['Mr.', 'Mrs.', 'Ms.'],
  productCounts: ['Fewer than 30 products', 'More than 30 products', 'More than 100 products', 'More than 1,000 products'],
  countries: ['Malaysia', 'Singapore', 'Other'],
  states: [
    'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah', 'Sarawak',
    'Selangor', 'Terengganu', 'Wilayah Persekutuan Kuala Lumpur', 'Wilayah Persekutuan Labuan', 'Wilayah Persekutuan Putrajaya',
  ],
};
