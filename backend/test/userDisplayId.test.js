import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTenantLetters,
  resolveTenantUserPrefix,
  nextUserDisplayId,
} from '../lib/userDisplayId.js';

test('normalizeTenantLetters strips spaces and non-letters', () => {
  assert.equal(normalizeTenantLetters('Kayu Putih'), 'KAYUPUTIH');
  assert.equal(normalizeTenantLetters('Umalila'), 'UMALILA');
});

test('resolveTenantUserPrefix uses 3 letters when unique', () => {
  assert.equal(
    resolveTenantUserPrefix('Umalila', ['Umalila', 'Kayuputih']),
    'UMA',
  );
  assert.equal(
    resolveTenantUserPrefix('Kayuputih', ['Umalila', 'Kayuputih']),
    'KAY',
  );
});

test('resolveTenantUserPrefix bumps length on collision', () => {
  assert.equal(
    resolveTenantUserPrefix('Kayu Putih', ['Kayu Putih', 'Kayaking']),
    'KAYU',
  );
  assert.equal(
    resolveTenantUserPrefix('Kayaking', ['Kayu Putih', 'Kayaking']),
    'KAYA',
  );
});

test('nextUserDisplayId increments within tenant prefix', () => {
  assert.equal(nextUserDisplayId([], 'UMA'), 'UMA001');
  assert.equal(nextUserDisplayId(['UMA001', 'UMA002'], 'UMA'), 'UMA003');
  assert.equal(nextUserDisplayId(['KAY001'], 'KAY'), 'KAY002');
});

test('nextUserDisplayId ignores other prefixes and legacy ids', () => {
  assert.equal(
    nextUserDisplayId(['UID-0001', 'UMA001', 'KAY001'], 'UMA'),
    'UMA002',
  );
});
