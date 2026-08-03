/**
 * リーチ麻雀の翻数・符から、点棒の支払いを計算する。
 * このファイルは画面に依存しないため、役判定を追加した後も同じ関数を使える。
 */

const roundUpToHundred = (value) => Math.ceil(value / 100) * 100;

function getBasePoints(han, fu) {
  if (han >= 13) return { basePoints: 8000, limitName: '数え役満' };
  if (han >= 11) return { basePoints: 6000, limitName: '三倍満' };
  if (han >= 8) return { basePoints: 4000, limitName: '倍満' };
  if (han >= 6) return { basePoints: 3000, limitName: '跳満' };
  if (han >= 5) return { basePoints: 2000, limitName: '満貫' };

  const basePoints = fu * 2 ** (han + 2);
  return basePoints >= 2000
    ? { basePoints: 2000, limitName: '満貫' }
    : { basePoints, limitName: null };
}

/**
 * @param {{ han: number, fu: number, isDealer: boolean, winMethod: 'ron'|'tsumo', honba?: number }} input
 */
export function calculateScore({ han, fu, isDealer, winMethod, honba = 0 }) {
  if (!Number.isInteger(han) || han < 1) {
    throw new Error('翻数は1以上の整数で入力してください。');
  }
  if (!Number.isInteger(fu) || fu < 20) {
    throw new Error('符は20以上の整数で入力してください。');
  }
  if (!['ron', 'tsumo'].includes(winMethod)) {
    throw new Error('和了方法はロンかツモを選んでください。');
  }
  if (!Number.isInteger(honba) || honba < 0) {
    throw new Error('本場数は0以上の整数で入力してください。');
  }

  const { basePoints, limitName } = getBasePoints(han, fu);
  const honbaRon = honba * 300;
  const honbaTsumo = honba * 100;

  if (winMethod === 'ron') {
    const payment = roundUpToHundred(basePoints * (isDealer ? 6 : 4));
    return {
      han,
      fu,
      basePoints,
      limitName,
      winMethod,
      isDealer,
      honba,
      payments: { discarder: payment + honbaRon },
      total: payment + honbaRon,
      summary: `放銃者 ${(payment + honbaRon).toLocaleString()}点`,
      detail: `基本点 ${payment.toLocaleString()}点 + 本場 ${honbaRon.toLocaleString()}点`,
    };
  }

  if (isDealer) {
    const each = roundUpToHundred(basePoints * 2) + honbaTsumo;
    return {
      han,
      fu,
      basePoints,
      limitName,
      winMethod,
      isDealer,
      honba,
      payments: { eachChild: each },
      total: each * 3,
      summary: `【${each.toLocaleString()} オール】`,
      detail: `子3人が各 ${each.toLocaleString()}点を支払い`,
    };
  }

  const fromDealer = roundUpToHundred(basePoints * 2) + honbaTsumo;
  const fromChild = roundUpToHundred(basePoints) + honbaTsumo;
  return {
    han,
    fu,
    basePoints,
    limitName,
    winMethod,
    isDealer,
    honba,
    payments: { dealer: fromDealer, eachChild: fromChild },
    total: fromDealer + fromChild * 2,
    summary: `【${fromChild.toLocaleString()}, ${fromDealer.toLocaleString()}】`,
    detail: `親 ${fromDealer.toLocaleString()}点、子2人が各 ${fromChild.toLocaleString()}点を支払い`,
  };
}
