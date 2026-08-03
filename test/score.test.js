import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateScore } from '../src/score.js';

test('子の30符3翻ロンは3,900点', () => {
  const score = calculateScore({ han: 3, fu: 30, isDealer: false, winMethod: 'ron' });
  assert.equal(score.payments.discarder, 3900);
  assert.equal(score.summary, '放銃者 3,900点');
});

test('親の30符3翻ツモは2,000オール', () => {
  const score = calculateScore({ han: 3, fu: 30, isDealer: true, winMethod: 'tsumo' });
  assert.equal(score.payments.eachChild, 2000);
  assert.equal(score.total, 6000);
});

test('子の40符3翻ツモは【1,300, 2,600】', () => {
  const score = calculateScore({ han: 3, fu: 40, isDealer: false, winMethod: 'tsumo' });
  assert.deepEqual(score.payments, { dealer: 2600, eachChild: 1300 });
  assert.equal(score.summary, '【1,300, 2,600】');
});

test('本場はロンに300点、ツモに各100点を加算する', () => {
  const ron = calculateScore({ han: 1, fu: 30, isDealer: false, winMethod: 'ron', honba: 2 });
  const tsumo = calculateScore({ han: 1, fu: 30, isDealer: false, winMethod: 'tsumo', honba: 2 });
  assert.equal(ron.payments.discarder, 1600);
  assert.deepEqual(tsumo.payments, { dealer: 700, eachChild: 500 });
});

test('満貫と数え役満を上限として扱う', () => {
  const mangan = calculateScore({ han: 5, fu: 20, isDealer: false, winMethod: 'ron' });
  const kazoeYakuman = calculateScore({ han: 13, fu: 30, isDealer: false, winMethod: 'ron' });
  assert.equal(mangan.limitName, '満貫');
  assert.equal(mangan.payments.discarder, 8000);
  assert.equal(kazoeYakuman.limitName, '数え役満');
  assert.equal(kazoeYakuman.payments.discarder, 32000);
});
