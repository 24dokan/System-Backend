import { buildOrders } from './order.import';

const row = (o: Record<string, string>) => ({ source: 'shopee', order_ref: 'A1', customer_name: 'Aina', phone: '', address: '1 Jalan Satu, KL', sku_code: 'X-1', qty: '2', unit_price: '', shipping: '', discount: '', note: '', ...o });

describe('buildOrders', () => {
  it('groups rows of one order', () => {
    const { valid, rejected } = buildOrders([row({}), row({ sku_code: 'X-2', qty: '1', unit_price: '9.90' })]);
    expect(rejected).toEqual([]);
    expect(valid).toHaveLength(1);
    expect(valid[0].source).toBe('SHOPEE');
    expect(valid[0].lines).toEqual([{ skuCode: 'X-1', qty: 2, unitPriceMinor: undefined }, { skuCode: 'X-2', qty: 1, unitPriceMinor: 990 }]);
  });
  it('rejects a bad source, bad qty and duplicate SKU', () => {
    const r = buildOrders([row({ source: 'ebay' }), row({ order_ref: 'B', qty: '0' }), row({ order_ref: 'C' }), row({ order_ref: 'C' })]);
    expect(r.valid).toEqual([]);
    expect(r.rejected).toHaveLength(3);
  });
  it('rejects a whole order when one line is bad', () => {
    const r = buildOrders([row({}), row({ sku_code: 'X-2', qty: 'abc' })]);
    expect(r.valid).toEqual([]);
    expect(r.rejected[0].rows).toEqual([2, 3]);
  });
});
