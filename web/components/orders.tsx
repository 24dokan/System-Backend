'use client';
import { Badge } from '@/components/ui';

export const STATUS_LABEL: Record<string, string> = { TO_PACK: 'To pack', PACKED: 'Packed', WAITING_PICKUP: 'Waiting pickup', SHIPPED: 'Shipped', CANCELLED: 'Cancelled' };
const TONE: Record<string, string> = { TO_PACK: 'amber', PACKED: 'blue', WAITING_PICKUP: 'purple', SHIPPED: 'green', CANCELLED: 'gray' };
export const SOURCE_LABEL: Record<string, string> = { SHOPEE: 'Shopee', LAZADA: 'Lazada', TIKTOK: 'TikTok', STOREFRONT: 'Storefront', OTHER: 'Other' };
export const SOURCES = Object.keys(SOURCE_LABEL);

export const OrderBadge = ({ status }: { status: string }) => <Badge tone={TONE[status] ?? 'gray'}>{STATUS_LABEL[status] ?? status}</Badge>;
export const orderNo = (n: number) => `#${n}`;
