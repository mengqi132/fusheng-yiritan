// ========== 界面渲染与动效 v2 ==========
import { GOODS } from './market.js';

const $ = (sel) => document.querySelector(sel);

export function fmt(n) {
  return '¥' + Math.round(n).toLocaleString('zh-CN');
}

// ---------- 主渲染 ----------
export function render(state) {
  renderTopbar(state);
  renderMarket(state);
  renderBag(state);
}

function renderTopbar(state) {
  $('#day-label').textContent = `第 ${state.day} 天`;

  const assetEl = $('#total-assets');
  const newVal = fmt(totalAssets(state));
  if (assetEl.textContent !== newVal) {
    assetEl.textContent = newVal;
    assetEl.classList.remove('bump');
    void assetEl.offsetWidth; // 重触发动画
    assetEl.classList.add('bump');
  }

  $('#cash').textContent = fmt(state.cash);
  $('#bank').textContent = fmt(state.bank);
  $('#loan').textContent = fmt(state.loan);
  $('#debt').textContent = fmt(state.debt);
  $('#bag-usage').textContent = `${bagCount(state)}/${state.capacity}`;

  // 日期进度条
  const bar = $('#day-progress');
  if (bar.children.length !== state.totalDays) {
    bar.innerHTML = '';
    for (let i = 0; i < state.totalDays; i++) {
      const seg = document.createElement('div');
      seg.className = 'seg';
      bar.appendChild(seg);
    }
  }
  [...bar.children].forEach((seg, i) => {
    seg.className = 'seg' + (i + 1 < state.day ? ' done' : i + 1 === state.day ? ' today' : '');
  });
}

function renderMarket(state) {
  const list = $('#market-list');
  list.innerHTML = '';
  for (const g of GOODS) {
    const price = state.prices[g.id];
    const chg = state.changes[g.id] ?? 0;
    const chgPct = (chg * 100).toFixed(1);
    const cls = chg > 0.001 ? 'up' : chg < -0.001 ? 'down' : 'flat';
    const arrow = chg > 0.001 ? '▲' : chg < -0.001 ? '▼' : '·';

    const row = document.createElement('div');
    row.className = 'row' + (state.flash && state.flash[g.id] ? ' ' + state.flash[g.id] : '');
    row.innerHTML = `
      <span class="g-icon">${g.icon}</span>
      <span class="g-name">${g.name}</span>
      <span class="g-price">${fmt(price)}</span>
      <span class="g-change ${cls}">${arrow} ${Math.abs(chgPct)}%</span>
      <span class="ops">
        <button class="btn-mini" data-act="buy" data-id="${g.id}" data-n="1"
          ${canBuy(state, g.id, 1) ? '' : 'disabled'}>买1</button>
        <button class="btn-mini" data-act="buy" data-id="${g.id}" data-n="10"
          ${canBuy(state, g.id, 10) ? '' : 'disabled'}>买10</button>
      </span>`;
    list.appendChild(row);
  }
}

function renderBag(state) {
  const list = $('#bag-list');
  list.innerHTML = '';
  const ids = Object.keys(state.bag).filter((id) => state.bag[id].count > 0);

  if (ids.length === 0) {
    list.innerHTML = '<div class="empty-tip">背包空空如也，去左边进点货吧</div>';
    return;
  }

  for (const id of ids) {
    const g = GOODS.find((x) => x.id === id);
    const item = state.bag[id];
    const price = state.prices[id];
    const profit = (price - item.totalCost / item.count) * item.count;
    const profitCls = profit >= 0 ? 'up' : 'down';
    const profitText = `${profit >= 0 ? '+' : '−'}${fmt(Math.abs(profit))}`;

    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <span class="g-icon">${g.icon}</span>
      <span class="g-name">${g.name} ×${item.count}
        <span class="sub">均价 ${fmt(item.totalCost / item.count)} · 浮盈 <b class="${profitCls}">${profitText}</b></span>
      </span>
      <span class="g-price">${fmt(price * item.count)}</span>
      <span class="ops">
        <button class="btn-mini sell" data-act="sell" data-id="${id}" data-n="1">卖1</button>
        <button class="btn-mini sell" data-act="sell" data-id="${id}" data-n="all">全卖</button>
      </span>`;
    list.appendChild(row);
  }
}

// ---------- 快讯 ----------
export function showNews(text) {
  $('#news-text').textContent = text;
}

// ---------- 浮动金额 ----------
export function spawnFloat(text, cls) {
  const layer = $('#float-layer');
  const el = document.createElement('div');
  el.className = 'float-text ' + cls;
  el.textContent = text;
  el.style.top = (Math.random() * 24) + 'px';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

// ---------- 通用弹窗 ----------
// cfg: { icon, title, desc, options: [{ label, sub, disabled, onPick }] , closable }
export function openModal(cfg) {
  const box = $('#modal-box');
  box.innerHTML = `
    <div class="modal-emoji">${cfg.icon}</div>
    <h2>${cfg.title}</h2>
    <p class="modal-desc">${cfg.desc}</p>
    <div class="${cfg.grid ? 'op-grid' : 'opt-list'}"></div>`;
  const list = box.querySelector('.opt-list, .op-grid');
  cfg.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'opt-btn';
    btn.disabled = !!opt.disabled;
    btn.innerHTML = opt.label + (opt.sub ? `<small>${opt.sub}</small>` : '');
    if (!opt.disabled) {
      btn.addEventListener('click', () => {
        closeModal();
        opt.onPick();
      });
    }
    list.appendChild(btn);
  });
  $('#modal-mask').classList.remove('hidden');
}

export function closeModal() {
  $('#modal-mask').classList.add('hidden');
}

export function isModalOpen() {
  return !$('#modal-mask').classList.contains('hidden');
}

// ---------- 结算 ----------
export function showSettlement(result) {
  $('#settlement-emoji').textContent = result.emoji;
  $('#settlement-title').textContent = result.title;
  $('#settlement-text').textContent = result.text;
  $('#final-assets').textContent = fmt(result.assets);
  $('#settlement-best').innerHTML = `🏅 历史最佳：<b>${fmt(result.best)}</b>`;
  const achBox = $('#settlement-ach');
  achBox.innerHTML = result.achList.length
    ? '<div class="ach-row">' +
      result.achList.map((a) => `<span class="ach-badge" title="${a.desc}">${a.icon} ${a.name}</span>`).join('') +
      '</div>'
    : '<div class="ach-none">本局未解锁成就，再试一局？</div>';
  $('#settlement-mask').classList.remove('hidden');
}

// ---------- 成就提示 toast ----------
export function showToast(ach) {
  const layer = $('#toast-layer');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `
    <span class="t-icon">${ach.icon}</span>
    <span><span class="t-name">成就解锁 · ${ach.name}</span><br>
    <span class="t-desc">${ach.desc}</span></span>`;
  layer.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 350);
  }, 2600);
}

// ---------- 静音按钮 ----------
export function updateMuteBtn(muted) {
  $('#btn-mute').textContent = muted ? '🔇' : '🔊';
}

export function hideSettlement() {
  $('#settlement-mask').classList.add('hidden');
}

// ---------- 工具函数 ----------
export function totalAssets(state) {
  let v = state.cash + state.bank;
  for (const id in state.bag) {
    v += state.bag[id].count * state.prices[id];
  }
  return v - state.loan;
}

export function bagCount(state) {
  let n = 0;
  for (const id in state.bag) n += state.bag[id].count;
  return n;
}

function canBuy(state, id, n) {
  return state.cash >= state.prices[id] * n && bagCount(state) + n <= state.capacity;
}
