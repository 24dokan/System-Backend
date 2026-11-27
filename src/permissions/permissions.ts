/**
 * Every action an administrator or staff member can be allowed to do.
 * A role is a named set of these keys. Add new keys here when a new admin feature is built.
 */
export const PERMISSIONS = [
  { key: 'sellers.view', group: 'Sellers', label: 'View sellers' },
  { key: 'sellers.approve', group: 'Sellers', label: 'Approve seller accounts' },
  { key: 'sellers.suspend', group: 'Sellers', label: 'Suspend sellers' },
  { key: 'sellers.view_sensitive', group: 'Sellers', label: 'See full ID and bank details of sellers' },
  { key: 'payments.view', group: 'Payments', label: 'View subscriptions and payments' },
  { key: 'payments.confirm', group: 'Payments', label: 'Confirm payments and assign packages' },
  { key: 'products.view', group: 'Products', label: 'View all products' },
  { key: 'products.review', group: 'Products', label: 'Approve or reject products and edits' },
  { key: 'categories.manage', group: 'Catalogue', label: 'Manage categories' },
  { key: 'features.manage', group: 'Catalogue', label: 'Manage product features' },
  { key: 'packages.manage', group: 'Catalogue', label: 'Manage seller packages' },
  { key: 'bank.manage', group: 'Settings', label: 'Change bank transfer details' },
  { key: 'staff.manage', group: 'Staff', label: 'Add and manage staff accounts' },
  { key: 'roles.manage', group: 'Staff', label: 'Create and edit roles' },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];
export const ALL_PERMISSION_KEYS: string[] = PERMISSIONS.map((p) => p.key);

/** Keeps only keys that exist, without duplicates. */
export const isValidPermission = (key: string) => ALL_PERMISSION_KEYS.includes(key);
