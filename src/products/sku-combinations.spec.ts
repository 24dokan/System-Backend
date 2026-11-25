import { cartesian, comboKey } from './sku-combinations';

describe('sku combinations', () => {
  it('builds every combination', () => {
    expect(cartesian([['S', 'M'], ['red', 'blue']])).toEqual([
      ['S', 'red'], ['S', 'blue'], ['M', 'red'], ['M', 'blue'],
    ]);
  });
  it('no options gives one default combination', () => expect(cartesian([])).toEqual([[]]));
  it('key ignores order', () => expect(comboKey(['b', 'a'])).toBe(comboKey(['a', 'b'])));
});
