import { nextStatus } from './transitions';

describe('approval state machine', () => {
  it('draft and rejected can be submitted', () => {
    expect(nextStatus('DRAFT', 'SUBMIT')).toBe('PENDING');
    expect(nextStatus('REJECTED', 'SUBMIT')).toBe('PENDING');
  });
  it('only pending products are approved or rejected', () => {
    expect(nextStatus('PENDING', 'APPROVE')).toBe('APPROVED');
    expect(nextStatus('PENDING', 'REJECT')).toBe('REJECTED');
    expect(nextStatus('DRAFT', 'APPROVE')).toBeNull();
    expect(nextStatus('APPROVED', 'REJECT')).toBeNull();
  });
  it('approved products go through revisions and come back approved', () => {
    expect(nextStatus('APPROVED', 'REVISION_SUBMIT')).toBe('PENDING_REVISION');
    expect(nextStatus('PENDING_REVISION', 'REVISION_APPROVE')).toBe('APPROVED');
    expect(nextStatus('PENDING_REVISION', 'REVISION_REJECT')).toBe('APPROVED');
  });
  it('only one revision at a time', () => expect(nextStatus('PENDING_REVISION', 'REVISION_SUBMIT')).toBeNull());
  it('a pending product cannot be resubmitted', () => expect(nextStatus('PENDING', 'SUBMIT')).toBeNull());
});
