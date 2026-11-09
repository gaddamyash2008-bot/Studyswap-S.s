const assert = require('node:assert/strict');
const test = require('node:test');
const { toPostgresSql } = require('./db');

test('converts SQLite placeholders to PostgreSQL parameters in order', () => {
  assert.equal(
    toPostgresSql('SELECT * FROM books WHERE id = ? AND seller_id = ?'),
    'SELECT * FROM books WHERE id = $1 AND seller_id = $2',
  );
});

test('leaves SQL without parameters unchanged', () => {
  assert.equal(toPostgresSql('SELECT * FROM books'), 'SELECT * FROM books');
});
