import { buildProducts, makeCategoryResolver, parsePrice } from './import.parser';

const cats = [
  { id: 'c1', name: 'Fashion', parentId: null },
  { id: 'c2', name: 'Shoes', parentId: 'c1' },
  { id: 'c3', name: 'Shoes', parentId: 'c9' },
  { id: 'c9', name: 'Kids', parentId: null },
];
const resolve = makeCategoryResolver(cats);
const row = (o: Record<string, string>) => ({ product_key: 'p1', name: 'Sneaker', category: 'Fashion > Shoes', price: '10', ...o });

describe('parsePrice', () => {
  it.each([['59.90', 5990], ['10', 1000], ['0.5', 50], ['1.05', 105]])('%s', (s, n) => expect(parsePrice(s)).toBe(n));
  it.each(['-1', 'abc', '1.234', '', '1,000'])('rejects %s', (s) => expect(parsePrice(s)).toBeNull());
});

describe('category resolver', () => {
  it('matches full path', () => expect(resolve('fashion > shoes')).toEqual({ id: 'c2' }));
  it('rejects ambiguous leaf names', () => expect(resolve('Shoes')).toHaveProperty('error'));
  it('unique leaf works', () => expect(resolve('Kids')).toEqual({ id: 'c9' }));
  it('unknown', () => expect(resolve('Nope')).toHaveProperty('error'));
});

describe('buildProducts', () => {
  it('groups rows into one product with options', () => {
    const { valid, rejected } = buildProducts(
      [
        row({ option1_name: 'Size', option1_value: 'S', price: '10' }),
        row({ option1_value: 'M', price: '11.50' }),
      ],
      resolve,
    );
    expect(rejected).toEqual([]);
    expect(valid[0].options).toEqual([{ name: 'Size', values: ['S', 'M'] }]);
    expect(valid[0].skus.map((s) => s.priceMinor)).toEqual([1000, 1150]);
  });
  it('rejects a bad price and keeps other products', () => {
    const { valid, rejected } = buildProducts([row({ price: 'x' }), row({ product_key: 'p2' })], resolve);
    expect(valid.map((p) => p.key)).toEqual(['p2']);
    expect(rejected[0].errors[0]).toMatch(/Row 2: price/);
  });
  it('rejects duplicate variations', () => {
    const { rejected } = buildProducts(
      [row({ option1_name: 'Size', option1_value: 'S' }), row({ option1_value: 's' })],
      resolve,
    );
    expect(rejected[0].errors.join()).toMatch(/duplicate variation/);
  });
  it('rejects a missing option value', () => {
    const { rejected } = buildProducts([row({ option1_name: 'Size', option1_value: 'S' }), row({})], resolve);
    expect(rejected[0].errors.join()).toMatch(/every option needs a value/);
  });
  it('rejects the same sku_code in two products', () => {
    const { valid, rejected } = buildProducts([row({ sku_code: 'ab-1' }), row({ product_key: 'p2', sku_code: 'AB-1' })], resolve);
    expect(valid).toHaveLength(1);
    expect(rejected[0].key).toBe('p2');
  });
  it('rejects an empty product_key', () => {
    expect(buildProducts([row({ product_key: '' })], resolve).rejected[0].key).toBeNull();
  });
});
