import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateFu } from '../src/fu.js';

test('門前ロンの嵌張待ちは40符になる', () => {
  const result = calculateFu({
    tiles: ['m1', 'm2', 'm3', 'p1', 'p2', 'p3', 's1', 's2', 's3', 's7', 's8', 's9', 'm5', 'm5'],
    winTile: 'p2', winMethod: 'ron', roundWind: 'east', seatWind: 'south',
  });
  assert.equal(result.fu, 40);
});

test('平和ツモは20符固定になる', () => {
  const result = calculateFu({
    tiles: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'p7', 'p8', 'p9', 's2', 's3', 's4', 'p5', 'p5'],
    winTile: 'm6', winMethod: 'tsumo', roundWind: 'east', seatWind: 'south',
  });
  assert.equal(result.fu, 20);
});

test('七対子は25符になる', () => {
  const result = calculateFu({
    tiles: ['m1', 'm1', 'm2', 'm2', 'p3', 'p3', 'p4', 'p4', 's5', 's5', 's6', 's6', 'z1', 'z1'],
    winTile: 'z1', winMethod: 'ron',
  });
  assert.equal(result.fu, 25);
});

test('明刻を含む鳴き手の符を計算できる', () => {
  const result = calculateFu({
    tiles: ['m1', 'm1', 'm1', 'p1', 'p2', 'p3', 's4', 's5', 's6', 'z5', 'z5', 'z5', 'm7', 'm7'],
    calls: [{ type: 'pon', tiles: ['z5', 'z5', 'z5'] }],
    winTile: 's6', winMethod: 'ron', roundWind: 'east', seatWind: 'south',
  });
  assert.equal(result.fu, 40);
  assert.ok(result.breakdown.includes('明刻（字牌）：4符'));
});
