import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPropertyDisplayDate,
  buildPropertyDisplayIdPrefix,
  nextPropertyDisplayId,
} from '../lib/propertyDisplayId.js';

test('formatPropertyDisplayDate uses MMDDYY', () => {
  const date = new Date(2026, 5, 27);
  assert.equal(formatPropertyDisplayDate(date), '062726');
});

test('nextPropertyDisplayId increments within the same date prefix', () => {
  const date = new Date(2026, 5, 27);
  const prefix = buildPropertyDisplayIdPrefix(date);

  assert.equal(
    nextPropertyDisplayId([], date),
    `${prefix}001`,
  );
  assert.equal(
    nextPropertyDisplayId([`${prefix}001`, `${prefix}002`], date),
    `${prefix}003`,
  );
});

test('nextPropertyDisplayId ignores other date prefixes and legacy ids', () => {
  const date = new Date(2026, 5, 27);
  const prefix = buildPropertyDisplayIdPrefix(date);

  assert.equal(
    nextPropertyDisplayId(['PRP-0001', 'PRP062625099', `${prefix}001`], date),
    `${prefix}002`,
  );
});
