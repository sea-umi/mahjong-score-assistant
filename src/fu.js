const normalize = (tile) => (tile.endsWith('0') ? `${tile[0]}5` : tile);
const suits = ['m', 'p', 's'];

const isTerminalOrHonor = (tile) => {
  const type = normalize(tile);
  return type[0] === 'z' || type[1] === '1' || type[1] === '9';
};

const windTile = { east: 'z1', south: 'z2', west: 'z3', north: 'z4' };

function countTiles(tiles) {
  const counts = new Map();
  for (const tile of tiles) {
    const type = normalize(tile);
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return counts;
}

function subtract(counts, tiles) {
  const next = new Map(counts);
  for (const tile of tiles) {
    const type = normalize(tile);
    const count = next.get(type) ?? 0;
    if (count < 1) return null;
    next.set(type, count - 1);
  }
  return next;
}

function firstAvailable(counts) {
  return [...counts.keys()].sort().find((tile) => (counts.get(tile) ?? 0) > 0);
}

function findMelds(counts, remainingMelds, melds = []) {
  if (remainingMelds === 0) return firstAvailable(counts) ? [] : [melds];
  const tile = firstAvailable(counts);
  if (!tile) return [];
  const results = [];

  if ((counts.get(tile) ?? 0) >= 3) {
    const next = subtract(counts, [tile, tile, tile]);
    results.push(...findMelds(next, remainingMelds - 1, [...melds, { kind: 'triplet', tile, open: false }]));
  }

  const rank = Number(tile[1]);
  if (suits.includes(tile[0]) && rank <= 7) {
    const sequence = [`${tile[0]}${rank}`, `${tile[0]}${rank + 1}`, `${tile[0]}${rank + 2}`];
    const next = subtract(counts, sequence);
    if (next) results.push(...findMelds(next, remainingMelds - 1, [...melds, { kind: 'sequence', tiles: sequence, open: false }]));
  }
  return results;
}

function fixedMeld(call) {
  if (call.type === 'chi') return { kind: 'sequence', tiles: call.tiles.map(normalize), open: true };
  if (call.type === 'pon') return { kind: 'triplet', tile: normalize(call.tiles[0]), open: true };
  return { kind: 'quad', tile: normalize(call.tiles[0]), open: call.type === 'open-kan' };
}

function pairFu(pair, roundWind, seatWind) {
  let fu = 0;
  if (['z5', 'z6', 'z7'].includes(pair)) fu += 2;
  if (pair === windTile[roundWind]) fu += 2;
  if (pair === windTile[seatWind]) fu += 2;
  return fu;
}

function meldFu(meld, winTile, winMethod) {
  if (meld.kind === 'sequence') return 0;
  const winningRonTriplet = meld.kind === 'triplet' && !meld.open && winMethod === 'ron' && meld.tile === winTile;
  const open = meld.open || winningRonTriplet;
  const terminal = isTerminalOrHonor(meld.tile);
  if (meld.kind === 'triplet') return (open ? 2 : 4) * (terminal ? 2 : 1);
  return (open ? 8 : 16) * (terminal ? 2 : 1);
}

function meldFuLabel(meld, winTile, winMethod) {
  const fu = meldFu(meld, winTile, winMethod);
  if (!fu) return null;
  const winningRonTriplet = meld.kind === 'triplet' && !meld.open && winMethod === 'ron' && meld.tile === winTile;
  const open = meld.open || winningRonTriplet;
  const tile = meld.tile;
  const category = tile[0] === 'z' ? '字牌' : isTerminalOrHonor(tile) ? '么九牌' : '中張牌';
  const name = meld.kind === 'triplet' ? (open ? '明刻' : '暗刻') : (open ? '明槓' : '暗槓');
  return `${name}（${category}）：${fu}符`;
}

function waitFu(pair, melds, winTile) {
  let highest = pair === winTile ? 2 : 0;
  for (const meld of melds) {
    if (meld.kind !== 'sequence' || !meld.tiles.includes(winTile)) continue;
    const start = Number(meld.tiles[0][1]);
    const rank = Number(winTile[1]);
    if (rank === start + 1 || (start === 1 && rank === 3) || (start === 7 && rank === 7)) highest = Math.max(highest, 2);
  }
  return highest;
}

function isSevenPairs(counts, calls) {
  return calls.length === 0 && [...counts.values()].filter((count) => count > 0).every((count) => count === 2) && [...counts.values()].filter((count) => count > 0).length === 7;
}

/**
 * 手牌・副露・和了牌から符を計算する。
 * 役があるかどうかの判定は別モジュールで担当する。
 */
export function calculateFu({ tiles, calls = [], winTile, winMethod, roundWind = 'east', seatWind = 'east' }) {
  if (!winTile) throw new Error('和了牌を選んでください。');
  const winningTile = normalize(winTile);
  const allCounts = countTiles(tiles);
  if (isSevenPairs(allCounts, calls)) return { fu: 25, rawFu: 25, type: '七対子', breakdown: ['七対子：25符'] };

  const concealedTiles = calls.flatMap((call) => call.tiles);
  const concealedCounts = subtract(allCounts, concealedTiles);
  if (!concealedCounts) throw new Error('副露の牌が手牌と一致していません。');

  const concealedMeldCount = 4 - calls.length;
  if (concealedMeldCount < 0) throw new Error('副露は4組までです。');
  const remainingCount = [...concealedCounts.values()].reduce((sum, count) => sum + count, 0);
  if (remainingCount !== concealedMeldCount * 3 + 2) throw new Error('手牌を4面子1雀頭または七対子の形にしてください。');

  const fixed = calls.map(fixedMeld);
  const choices = [];
  for (const [pair, count] of concealedCounts.entries()) {
    if (count < 2) continue;
    const withoutPair = subtract(concealedCounts, [pair, pair]);
    for (const hiddenMelds of findMelds(withoutPair, concealedMeldCount)) {
      const melds = [...fixed, ...hiddenMelds];
      const valuePairFu = pairFu(pair, roundWind, seatWind);
      const shapeWaitFu = waitFu(pair, hiddenMelds, winningTile);
      const closed = !calls.some((call) => ['chi', 'pon', 'open-kan'].includes(call.type));
      const pinfu = closed && melds.every((meld) => meld.kind === 'sequence') && valuePairFu === 0 && shapeWaitFu === 0;
      const meldDetails = melds.map((meld) => meldFuLabel(meld, winningTile, winMethod)).filter(Boolean);
      const meldTotal = melds.reduce((sum, meld) => sum + meldFu(meld, winningTile, winMethod), 0);
      const rawFu = pinfu ? (winMethod === 'tsumo' ? 20 : 30) : 20 + (closed && winMethod === 'ron' ? 10 : 0) + (winMethod === 'tsumo' ? 2 : 0) + meldTotal + valuePairFu + shapeWaitFu;
      const fu = Math.ceil(rawFu / 10) * 10;
      const breakdown = ['副底：20符'];
      if (pinfu) breakdown.push(winMethod === 'tsumo' ? '平和ツモ：20符固定' : '門前ロン：30符');
      else {
        if (closed && winMethod === 'ron') breakdown.push('門前ロン：10符');
        if (winMethod === 'tsumo') breakdown.push('ツモ：2符');
        breakdown.push(...meldDetails);
        if (valuePairFu) breakdown.push(`雀頭：${valuePairFu}符`);
        if (shapeWaitFu) breakdown.push(`待ち：${shapeWaitFu}符`);
        if (fu !== rawFu) breakdown.push(`切り上げ：${rawFu}符 → ${fu}符`);
      }
      choices.push({ fu, rawFu, type: pinfu ? '平和形' : '通常形', breakdown });
    }
  }
  if (!choices.length) throw new Error('手牌を4面子1雀頭または七対子の形に分けられません。');
  return choices.sort((left, right) => right.fu - left.fu)[0];
}
