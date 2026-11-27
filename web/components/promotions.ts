import { money } from '@/lib/format';

export const PROMO_TONE: Record<string, string> = { PENDING: 'amber', APPROVED: 'green', REJECTED: 'red', CANCELLED: 'gray' };
export const PROMO_LABEL: Record<string, string> = { PENDING: 'Waiting for approval', APPROVED: 'Approved', REJECTED: 'Declined', CANCELLED: 'Cancelled' };
export const off = (p: any) => (p.type === 'PERCENT' ? `${p.value}% off` : `${money(p.value)} off`);

