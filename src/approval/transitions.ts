import { ProductStatus } from '@prisma/client';

export type Transition = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'REVISION_SUBMIT' | 'REVISION_APPROVE' | 'REVISION_REJECT';

/** The whole product approval state machine in one place. null = not allowed from that status. */
const TABLE: Record<Transition, Partial<Record<ProductStatus, ProductStatus>>> = {
  SUBMIT: { DRAFT: 'PENDING', REJECTED: 'PENDING' },
  APPROVE: { PENDING: 'APPROVED' },
  REJECT: { PENDING: 'REJECTED' },
  REVISION_SUBMIT: { APPROVED: 'PENDING_REVISION' },
  REVISION_APPROVE: { PENDING_REVISION: 'APPROVED' },
  REVISION_REJECT: { PENDING_REVISION: 'APPROVED' },
};

export function nextStatus(from: ProductStatus, action: Transition): ProductStatus | null {
  return TABLE[action][from] ?? null;
}
