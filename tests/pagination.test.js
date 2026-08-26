const { encodeCursor, decodeCursor } = require('../src/utils/pagination');

describe('decodeCursor', () => {
  test('round-trips a valid cursor', () => {
    const id = '507f1f77bcf86cd799439011';
    const cursor = encodeCursor(42, id);
    expect(decodeCursor(cursor)).toEqual({ sortVal: 42, id });
  });

  test('rejects a cursor carrying a Mongo query operator as sortVal', () => {
    const malicious = Buffer.from(
      JSON.stringify({ sortVal: { $gt: '' }, id: '507f1f77bcf86cd799439011' }),
      'utf8'
    ).toString('base64url');
    expect(decodeCursor(malicious)).toBeNull();
  });

  test('rejects a cursor with a non-ObjectId id', () => {
    const malicious = Buffer.from(
      JSON.stringify({ sortVal: 1, id: { $where: '1==1' } }),
      'utf8'
    ).toString('base64url');
    expect(decodeCursor(malicious)).toBeNull();
  });

  test('rejects garbage input', () => {
    expect(decodeCursor('not-valid-base64url-json')).toBeNull();
    expect(decodeCursor('')).toBeNull();
  });
});
