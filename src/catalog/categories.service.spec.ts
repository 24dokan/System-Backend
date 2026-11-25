import { Category } from '@prisma/client';
import { buildTree } from './categories.service';

const cat = (id: string, parentId: string | null): Category =>
  ({ id, name: id, parentId, commissionPercent: 0, isActive: true }) as unknown as Category;

describe('buildTree', () => {
  it('nests children under parents', () => {
    const tree = buildTree([cat('a', null), cat('b', 'a'), cat('c', 'b'), cat('d', null)]);
    expect(tree.map((n) => n.id)).toEqual(['a', 'd']);
    expect(tree[0].children[0].children[0].id).toBe('c');
  });
  it('treats an orphan as a root', () => {
    expect(buildTree([cat('x', 'missing')]).map((n) => n.id)).toEqual([]);
  });
});
