import './style.css';
import { calculateFu } from './fu.js';
import { calculateScore } from './score.js';

const names = {
  m: ['一萬', '二萬', '三萬', '四萬', '五萬', '赤五萬', '六萬', '七萬', '八萬', '九萬'],
  p: ['一筒', '二筒', '三筒', '四筒', '五筒', '赤五筒', '六筒', '七筒', '八筒', '九筒'],
  s: ['一索', '二索', '三索', '四索', '五索', '赤五索', '六索', '七索', '八索', '九索'],
  z: ['東', '南', '西', '北', '白', '發', '中'],
};
const callNames = { chi: 'チー', pon: 'ポン', 'open-kan': '明槓', 'closed-kan': '暗槓' };
const suits = ['m', 'p', 's'];
const ranksWithRed = [1, 2, 3, 4, 5, 0, 6, 7, 8, 9];
const app = document.querySelector('#app');

const state = {
  tiles: [], handConfirmed: false,
  calls: [], callsConfirmed: false, callType: 'chi', callDraft: [],
  dora: [], ura: [], doraConfirmed: false, uraConfirmed: false,
  winTile: '', activeTarget: 'hand',
  scoreMode: 'quick', winMethod: 'ron', isDealer: false, honba: 0,
  manualHan: 1, roundWind: 'east', seatWind: 'east', situations: new Set(), error: '', result: null,
};

const norm = (tile) => (tile?.endsWith('0') ? `${tile[0]}5` : tile);
const tileName = (tile) => tile[0] === 'z'
  ? names.z[Number(tile[1]) - 1]
  : names[tile[0]][ranksWithRed.indexOf(Number(tile.slice(1)))];
const face = (tile) => `<img class="mahjong-face" src="/tiles/cards/${tile}.png?v=4" alt="${tileName(tile)}">`;
const usedCount = (tile) => state.tiles.filter((item) => norm(item) === norm(tile)).length;
const expectedTileCount = () => 14 + state.calls.filter((call) => call.type.includes('kan')).length;
const formatNumber = (value) => value.toLocaleString('ja-JP');
const tileOrder = { m: 0, p: 1, s: 2, z: 3 };

function sortHandTiles() {
  state.tiles.sort((left, right) => {
    const suitDifference = tileOrder[left[0]] - tileOrder[right[0]];
    if (suitDifference) return suitDifference;
    const rankDifference = Number(norm(left)[1]) - Number(norm(right)[1]);
    if (rankDifference) return rankDifference;
    // 同じ五牌なら通常牌を先、赤牌を後に並べる。
    return Number(left.endsWith('0')) - Number(right.endsWith('0'));
  });
}

function selected(tiles, action, empty = '未選択です') {
  return tiles.length
    ? tiles.map((tile, index) => `<span class="selected-face">${face(tile)}<button type="button" data-action="${action}" data-index="${index}" aria-label="${tileName(tile)}を削除">×</button></span>`).join('')
    : `<p class="muted">${empty}</p>`;
}

function picker(target) {
  const row = (label, ids) => `<div class="picker-row"><span>${label}</span><div>${ids.map((tile) => `
    <button type="button" class="tile-button image-button" data-target="${target}" data-tile="${tile}"
      style="--tile-image:url('/tiles/cards/${tile}.png?v=4')" aria-label="${tileName(tile)}"
      ${target === 'hand' && usedCount(tile) >= 4 ? 'disabled' : ''}></button>`).join('')}</div></div>`;
  return suits.map((suit, index) => row(['萬子', '筒子', '索子'][index], ranksWithRed.map((rank) => `${suit}${rank}`))).join('')
    + row('字牌', [1, 2, 3, 4, 5, 6, 7].map((rank) => `z${rank}`));
}

function statusPanel() {
  const situationNames = ['リーチ', 'ダブルリーチ', '一発', '嶺上開花', '槍槓', '海底摸月', '河底撈魚'];
  const quickFields = state.scoreMode === 'quick'
    ? `<label>合計翻数<input data-field="manualHan" type="number" min="1" max="99" value="${state.manualHan}"></label>`
    : '';
  return `<aside class="context-panel">
    <h2>計算の状況</h2>
    <div class="two-col">
      <label>計算方法<select data-field="scoreMode"><option value="quick" ${state.scoreMode === 'quick' ? 'selected' : ''}>翻数を自分で入力</option><option value="auto" ${state.scoreMode === 'auto' ? 'selected' : ''}>役・翻数を自動判定</option></select></label>
      <label>和了<select data-field="winMethod"><option value="ron" ${state.winMethod === 'ron' ? 'selected' : ''}>ロン</option><option value="tsumo" ${state.winMethod === 'tsumo' ? 'selected' : ''}>ツモ</option></select></label>
      <label>立場<select data-field="isDealer"><option value="false" ${!state.isDealer ? 'selected' : ''}>子</option><option value="true" ${state.isDealer ? 'selected' : ''}>親</option></select></label>
      <label>本場<input data-field="honba" type="number" value="${state.honba}" min="0" max="99"></label>
      <label>場風<select data-field="roundWind">${[['east', '東場'], ['south', '南場'], ['west', '西場'], ['north', '北場']].map(([value, label]) => `<option value="${value}" ${state.roundWind === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label>自風<select data-field="seatWind">${[['east', '東家'], ['south', '南家'], ['west', '西家'], ['north', '北家']].map(([value, label]) => `<option value="${value}" ${state.seatWind === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      ${quickFields}
    </div>
    ${state.scoreMode === 'quick'
      ? '<p class="guide">合計翻数には、成立役・ドラ・赤ドラ・裏ドラ（リーチ時のみ）をすべて含めた最終合計を入力します。状況役はこの合計に追加されないため、入力欄は表示しません。符は手牌・副露・和了牌から自動計算します。</p>'
      : `<p class="guide">自動役判定では、下の状況役も翻数へ自動加算します。</p><fieldset class="checks"><legend>状況役</legend>${situationNames.map((name) => `<label><input data-situation="${name}" type="checkbox" ${state.situations.has(name) ? 'checked' : ''}>${name}</label>`).join('')}</fieldset>`}
  </aside>`;
}

function handBlock() {
  const content = state.handConfirmed
    ? `<div class="selected-area compact-list">${selected(state.tiles, 'remove-hand')}</div><button type="button" class="secondary" data-action="edit-hand">手牌を修正する</button>`
    : `<h3>選択した牌 <small>${state.tiles.length}枚</small></h3><div class="selected-area">${selected(state.tiles, 'remove-hand')}</div><button type="button" class="primary" data-action="confirm-hand">手牌を確定する</button>`;
  return `<section class="entry-block ${state.handConfirmed ? 'confirmed' : ''}"><div class="block-title"><div><h2>1. 手牌</h2><p>和了後のすべての牌を選びます。副露にする牌もここで選びます。</p></div></div>${content}</section>`;
}

function callBlock() {
  if (!state.handConfirmed) return '';
  const used = state.calls.flatMap((call) => call.indices);
  const available = state.tiles.map((tile, index) => ({ tile, index })).filter(({ index }) => !used.includes(index));
  const callList = state.calls.length
    ? state.calls.map((call, index) => `<div class="call-item"><b>${callNames[call.type]}</b>${call.tiles.map(face).join('')}<button type="button" class="text-button" data-action="remove-call" data-index="${index}">解除</button></div>`).join('')
    : '<p class="muted">副露なし</p>';
  const editor = `<div class="call-type">${Object.entries(callNames).map(([key, name]) => `<button type="button" class="${state.callType === key ? 'active' : ''}" data-action="call-type" data-type="${key}">${name}</button>`).join('')}</div>
    <p class="subhead">副露にする牌を選択（${state.callDraft.length}枚）</p><div class="selected-area available">${available.map(({ tile, index }) => `<button type="button" class="available-tile ${state.callDraft.includes(index) ? 'chosen' : ''}" data-action="draft" data-index="${index}">${face(tile)}</button>`).join('')}</div>
    <button type="button" class="secondary" data-action="save-call">この副露を追加</button><div class="calls">${callList}</div><button type="button" class="primary" data-action="confirm-calls">${state.calls.length ? '副露を確定して次へ' : '副露なしで次へ'}</button>`;
  const fixed = `<div class="calls">${callList}</div><button type="button" class="secondary" data-action="edit-calls">副露を修正する</button>`;
  return `<section class="entry-block ${state.callsConfirmed ? 'confirmed' : ''}"><div class="block-title"><div><h2>2. 副露</h2><p>チー・ポン・明槓・暗槓を登録します。副露がなければ、そのまま次へ進めます。</p></div></div>${state.callsConfirmed ? fixed : editor}</section>`;
}

function paletteBlock() {
  const labels = { hand: '手牌', dora: 'ドラ表示牌', ura: '裏ドラ表示牌' };
  return `<section class="tile-palette"><span class="eyebrow dark">牌を選択</span><h2>選択中：${labels[state.activeTarget]}</h2><p>下の牌をタップすると、選択中の項目に追加されます。</p><div class="tile-picker">${picker(state.activeTarget)}</div></section>`;
}

function indicatorCard(key, title, description) {
  const locked = state[`${key}Confirmed`];
  const unavailable = key === 'ura' && !state.doraConfirmed;
  const buttons = unavailable ? '<p class="muted">ドラ表示牌を確定すると選べます。</p>'
    : locked ? '<p class="confirmed-note">✓ 確定済み</p>'
      : `<div class="indicator-selection-row"><div class="selected-area compact-list">${selected(state[key], `remove-${key}`, '選択しない')}</div><div class="indicator-actions">${key === 'ura' ? '<button type="button" class="secondary" data-action="no-ura">なし</button>' : ''}<button type="button" class="primary" data-action="confirm-indicator" data-target="${key}">確定</button></div></div>`;
  return `<section class="indicator-card ${unavailable ? 'disabled-card' : ''}"><h2>${title}</h2><p>${description}</p>${locked ? `<div class="selected-area compact-list">${state[key].length ? state[key].map(face).join('') : '<p class="muted">なし</p>'}</div>` : ''}${buttons}</section>`;
}

function resultView() {
  if (!state.result) return '';
  if (state.result.type === 'notice') return `<h2>自動判定は準備中です</h2><p>${state.result.message}</p>`;
  const score = state.result;
  const limit = score.limitName ? `（${score.limitName}）` : '';
  return `<h2>計算結果</h2><p class="eyebrow dark">${score.han}翻 ${score.fu}符 ${limit}</p><h3>${score.summary}</h3><p>${score.detail}</p><details><summary>符の内訳</summary><p>${score.fuBreakdown.join('／')}</p></details><button type="button" class="secondary" data-action="reset">次局を計算する</button>`;
}

function afterCalls() {
  if (!state.callsConfirmed) return '';
  const callIndices = state.calls.flatMap((call) => call.indices);
  const available = state.tiles.map((tile, index) => ({ tile, index })).filter(({ index }) => !callIndices.includes(index));
  const win = `<section class="entry-block win-block"><div class="block-title"><div><h2>3. 和了牌</h2><p>副露ではない牌から、和了した1枚を選びます。</p></div></div><div class="selected-area available">${available.map(({ tile, index }) => `<button type="button" class="available-tile ${state.winTile === index ? 'chosen' : ''}" data-action="win" data-index="${index}">${face(tile)}</button>`).join('')}</div><div class="selected-area compact-list">${state.winTile === '' ? '<p class="muted">未選択です</p>' : selected([state.tiles[state.winTile]], 'remove-win')}</div><button type="button" class="primary" data-action="calculate">点数を計算する</button></section>`;
  // 手入力ではドラ分も合計翻数に含めるため、ドラ表示牌の入力を省略する。
  if (state.scoreMode === 'quick') return win;
  return `<div class="indicator-row">${indicatorCard('dora', 'ドラ表示牌', '最大5枚まで選択')}${indicatorCard('ura', '裏ドラ表示牌', 'リーチ時のみ翻数へ加算')}</div>${state.doraConfirmed && state.uraConfirmed ? win : ''}`;
}

function render() {
  app.innerHTML = `<header class="site-header"><div class="brand">🀄 麻雀点数計算アシスタント</div><p>牌を置く感覚で、点棒のやり取りを確認</p></header><main><section class="hero compact-hero"><span class="eyebrow">四人打ち・リーチ麻雀</span><h1>和了形を選択して点数を速攻確認！</h1></section>${statusPanel()}${paletteBlock()}<div class="entry-flow">${handBlock()}${callBlock()}${afterCalls()}</div><div id="form-error" class="form-error">${state.error}</div><section id="result" class="result">${resultView()}</section></main>`;
  bind();
}

function setError(message) {
  state.error = message;
  const errorBox = document.querySelector('#form-error');
  if (errorBox) errorBox.textContent = message;
}

function callError() {
  const needed = state.callType.includes('kan') ? 4 : 3;
  if (state.callDraft.length !== needed) return `${callNames[state.callType]}は${needed}枚選択してください。`;
  const tiles = state.callDraft.map((index) => norm(state.tiles[index])).sort();
  if (state.callType === 'chi') {
    const suitsInCall = tiles.map((tile) => tile[0]);
    const ranks = tiles.map((tile) => Number(tile[1]));
    if (suitsInCall.includes('z') || new Set(suitsInCall).size !== 1 || !(ranks[1] === ranks[0] + 1 && ranks[2] === ranks[0] + 2)) return 'チーは同じ種類の連続した3枚を選んでください。';
  } else if (new Set(tiles).size !== 1) return `${callNames[state.callType]}は同じ牌で作ってください。`;
  return '';
}

function resetHand() {
  Object.assign(state, { tiles: [], handConfirmed: false, calls: [], callsConfirmed: false, callDraft: [], dora: [], ura: [], doraConfirmed: false, uraConfirmed: false, winTile: '', activeTarget: 'hand', error: '', result: null });
}

function bind() {
  // 数字入力中に画面全体を描き直すとフォーカスが外れるため、値だけを保存する。
  document.querySelectorAll('[data-field="manualHan"], [data-field="honba"]').forEach((element) => element.addEventListener('input', () => {
    if (element.dataset.field === 'manualHan') state.manualHan = Number(element.value);
    if (element.dataset.field === 'honba') state.honba = Number(element.value);
    state.result = null;
  }));
  document.querySelectorAll('[data-field]').forEach((element) => element.addEventListener('change', () => {
    const { field, value } = element.dataset.field ? { field: element.dataset.field, value: element.value } : {};
    if (field === 'scoreMode') {
      state.scoreMode = value;
      state.activeTarget = value === 'quick' ? 'hand' : (state.callsConfirmed ? 'dora' : 'hand');
    }
    if (field === 'winMethod') state.winMethod = value;
    if (field === 'isDealer') state.isDealer = value === 'true';
    if (field === 'honba') state.honba = Number(value);
    if (field === 'manualHan') state.manualHan = Number(value);
    if (field === 'roundWind') state.roundWind = value;
    if (field === 'seatWind') state.seatWind = value;
    state.result = null; state.error = '';
    // 数値入力は入力中のフォーカスを守るため、ここでは再描画しない。
    if (field !== 'manualHan' && field !== 'honba') render();
  }));
  document.querySelectorAll('[data-situation]').forEach((element) => element.addEventListener('change', () => {
    element.checked ? state.situations.add(element.dataset.situation) : state.situations.delete(element.dataset.situation);
  }));
  // data-target は「確定」ボタンにも使うため、牌そのもの（data-tile があるボタン）だけを対象にする。
  document.querySelectorAll('[data-target="hand"][data-tile]').forEach((button) => button.addEventListener('click', () => { state.tiles.push(button.dataset.tile); sortHandTiles(); state.error = ''; render(); }));
  ['dora', 'ura'].forEach((key) => document.querySelectorAll(`[data-target="${key}"][data-tile]`).forEach((button) => button.addEventListener('click', () => { if (state[key].length < 5) state[key].push(button.dataset.tile); state.error = ''; render(); })));
  document.querySelectorAll('[data-action="remove-hand"]').forEach((button) => button.addEventListener('click', () => { state.tiles.splice(Number(button.dataset.index), 1); Object.assign(state, { handConfirmed: false, calls: [], callsConfirmed: false, winTile: '', result: null }); render(); }));
  ['dora', 'ura'].forEach((key) => document.querySelectorAll(`[data-action="remove-${key}"]`).forEach((button) => button.addEventListener('click', () => { state[key].splice(Number(button.dataset.index), 1); render(); })));
  document.querySelector('[data-action="confirm-hand"]')?.addEventListener('click', () => { if (state.tiles.length < 14) return setError('和了後の全牌を14枚以上選んでください。'); state.handConfirmed = true; state.error = ''; render(); });
  document.querySelector('[data-action="edit-hand"]')?.addEventListener('click', () => { Object.assign(state, { handConfirmed: false, calls: [], callsConfirmed: false, winTile: '', result: null }); render(); });
  document.querySelectorAll('[data-action="call-type"]').forEach((button) => button.addEventListener('click', () => { state.callType = button.dataset.type; state.callDraft = []; render(); }));
  document.querySelectorAll('[data-action="draft"]').forEach((button) => button.addEventListener('click', () => { const index = Number(button.dataset.index); state.callDraft = state.callDraft.includes(index) ? state.callDraft.filter((item) => item !== index) : [...state.callDraft, index]; render(); }));
  document.querySelector('[data-action="save-call"]')?.addEventListener('click', () => { const message = callError(); if (message) return setError(message); if (state.calls.length === 4) return setError('副露は最大4組です。'); state.calls.push({ type: state.callType, indices: [...state.callDraft], tiles: state.callDraft.map((index) => state.tiles[index]) }); state.callDraft = []; state.error = ''; render(); });
  document.querySelectorAll('[data-action="remove-call"]').forEach((button) => button.addEventListener('click', () => { state.calls.splice(Number(button.dataset.index), 1); Object.assign(state, { callsConfirmed: false, winTile: '', result: null }); render(); }));
  document.querySelector('[data-action="confirm-calls"]')?.addEventListener('click', () => { if (state.callDraft.length) return setError('選択中の副露を追加するか、選択を解除してください。'); state.callsConfirmed = true; state.activeTarget = state.scoreMode === 'auto' ? 'dora' : 'hand'; state.error = ''; render(); });
  document.querySelector('[data-action="edit-calls"]')?.addEventListener('click', () => { Object.assign(state, { callsConfirmed: false, winTile: '', result: null }); render(); });
  document.querySelectorAll('[data-action="confirm-indicator"]').forEach((button) => button.addEventListener('click', () => { const key = button.dataset.target; if (key === 'dora' && !state.dora.length) return setError('ドラ表示牌を1枚以上選んでください。'); state[`${key}Confirmed`] = true; state.activeTarget = key === 'dora' ? 'ura' : 'hand'; state.error = ''; render(); }));
  document.querySelector('[data-action="no-ura"]')?.addEventListener('click', () => { state.ura = []; state.uraConfirmed = true; state.activeTarget = 'hand'; render(); });
  document.querySelectorAll('[data-action="win"]').forEach((button) => button.addEventListener('click', () => { state.winTile = Number(button.dataset.index); state.result = null; render(); }));
  document.querySelector('[data-action="remove-win"]')?.addEventListener('click', () => { state.winTile = ''; state.result = null; render(); });
  document.querySelector('[data-action="calculate"]')?.addEventListener('click', () => {
    if (state.winTile === '') return setError('和了牌を選んでください。');
    if (state.tiles.length !== expectedTileCount()) return setError(`牌の合計を${expectedTileCount()}枚にしてください。現在は${state.tiles.length}枚です。`);
    if (state.scoreMode === 'auto') { state.result = { type: 'notice', message: '役・符の自動判定はまだ接続していません。いったん「翻数を自分で入力」で点数計算を試してください。' }; state.error = ''; render(); return; }
    try {
      const fuResult = calculateFu({ tiles: state.tiles, calls: state.calls, winTile: state.tiles[state.winTile], winMethod: state.winMethod, roundWind: state.roundWind, seatWind: state.seatWind });
      state.result = { ...calculateScore({ han: state.manualHan, fu: fuResult.fu, isDealer: state.isDealer, winMethod: state.winMethod, honba: state.honba }), fuBreakdown: fuResult.breakdown };
      state.error = '';
    } catch (error) { setError(error.message); }
    render();
  });
  document.querySelector('[data-action="reset"]')?.addEventListener('click', () => { resetHand(); render(); });
}

render();
