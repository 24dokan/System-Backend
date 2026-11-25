import { csvCell, toCsv } from './csv.util';

describe('csv', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('x\ny')).toBe('"x\ny"');
  });
  it('defuses formulas', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('@cmd')).toBe("'@cmd");
  });
  it('writes null as empty', () => expect(csvCell(null)).toBe(''));
  it('joins rows with CRLF', () => expect(toCsv(['a', 'b'], [[1, 2]])).toBe('a,b\r\n1,2\r\n'));
});
