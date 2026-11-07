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
  renderChart(state);
}

// ---------- 迷你走势线（SVG sparkline）----------
function sparklineSVG(data, trendCls) {
  if (!data || data.length < 2) return '<svg class="spark"></svg>';
  const w = 56, h = 20;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (w - 4) + 2;
    const y = h - 3 - ((v - min) / span) * (h - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const color = trendCls === 'up' ? '#FF5A5A' : trendCls === 'down' ? '#3DDC97' : '#8B93A7';
  return `<svg class="spark" viewBox="0 0 ${w} ${h}">` +
    `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" ` +
    `stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/></svg>`;
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

    // 热度徽章
    const heat = state.heats?.[g.id] ?? 50;
    const heatCls = heat < 35 ? 'heat-cool' : heat < 60 ? 'heat-mild' : heat < 85 ? 'heat-warm' : heat < 95 ? 'heat-hot' : 'heat-max';
    const heatChip = `<span class="g-heat ${heatCls}" style="--heat:${heat}%" ` +
      `title="市场热度 ${heat}/100 · 热度越高明天越容易涨，爆表后小心见顶">🔥${heat}</span>`;

    const row = document.createElement('div');
    row.className = 'row' + (state.flash && state.flash[g.id] ? ' ' + state.flash[g.id] : '');
    row.innerHTML = `
      <span class="g-icon">${g.icon}</span>
      <span class="g-name">${g.name}</span>
      ${sparklineSVG(state.history?.[g.id], cls)}
      <span class="g-price">${fmt(price)}</span>
      <span class="g-change ${cls}">${arrow} ${Math.abs(chgPct)}%</span>
      ${heatChip}
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

// ---------- 价格走势大图（Canvas） ----------
let chartSel = 'gpu';
let chartHover = -1;
let chartBound = false;
let lastState = null;

export function renderChart(state) {
  lastState = state;
  const g0 = GOODS.find((g) => g.id === chartSel) || GOODS[0];
  $('#chart-sub').textContent = `${g0.icon} ${g0.name} · 近 ${Math.max((state.history?.[chartSel] || []).length, 1)} 天`;

  // 商品切换标签
  const tabs = $('#chart-tabs');
  tabs.innerHTML = '';
  for (const g of GOODS) {
    const chg = state.changes[g.id] ?? 0;
    const cls = chg > 0.001 ? 'up' : chg < -0.001 ? 'down' : 'flat';
    const arrow = chg > 0.001 ? '▲' : chg < -0.001 ? '▼' : '·';
    const b = document.createElement('button');
    b.className = 'chip' + (g.id === chartSel ? ' active' : '');
    b.innerHTML = `${g.icon} ${g.name} <span class="${cls}">${arrow}</span>`;
    b.addEventListener('click', () => { chartSel = g.id; chartHover = -1; renderChart(lastState); });
    tabs.appendChild(b);
  }

  bindChartHover();
  drawChart(state);
}

function bindChartHover() {
  if (chartBound) return;
  chartBound = true;
  const canvas = document.querySelector('#price-chart');
  canvas.addEventListener('mousemove', (e) => {
    if (!lastState) return;
    const data = lastState.history?.[chartSel] || [];
    if (data.length < 2) return;
    const rect = canvas.getBoundingClientRect();
    const m = chartMetrics(rect.width, data.length);
    const i = Math.round((e.clientX - rect.left - m.padL) / m.stepX);
    chartHover = Math.max(0, Math.min(data.length - 1, i));
    drawChart(lastState);
  });
  canvas.addEventListener('mouseleave', () => {
    chartHover = -1;
    document.querySelector('#chart-tooltip').classList.add('hidden');
    if (lastState) drawChart(lastState);
  });
  window.addEventListener('resize', () => { if (lastState) drawChart(lastState); });
}

function chartMetrics(width, len) {
  const padL = 58, padR = 66, padT = 20, padB = 28;
  const stepX = len > 1 ? (width - padL - padR) / (len - 1) : 0;
  return { padL, padR, padT, padB, stepX };
}

function drawChart(state) {
  const canvas = $('#price-chart');
  if (!canvas) return;
  const g = GOODS.find((x) => x.id === chartSel);
  const data = (state.history && state.history[chartSel]) || [];
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.parentElement.clientWidth;
  const h = 220;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const { padL, padR, padT, padB } = chartMetrics(w, data.length);
  if (data.length === 0) return;

  // 纵轴范围（上下留 15% 缓冲）
  const min = Math.min(...data), max = Math.max(...data);
  const pad = (max - min || 1) * 0.15;
  const lo = min - pad, hi = max + pad;
  const X = (i) => data.length > 1 ? padL + (w - padL - padR) * (i / (data.length - 1)) : (padL + w - padR) / 2;
  const Y = (v) => padT + (h - padT - padB) * (1 - (v - lo) / (hi - lo));

  // 趋势色：红涨绿跌
  const up = data[data.length - 1] >= data[0];
  const cMain = up ? '#FF5A5A' : '#3DDC97';

  // 网格线 + 价格刻度
  ctx.font = '11px Consolas, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const v = lo + (hi - lo) * (i / 4);
    const y = Y(v);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();
    ctx.fillStyle = '#8B93A7';
    ctx.fillText('¥' + Math.round(v).toLocaleString('zh-CN'), padL - 8, y);
  }

  // 横轴：第 N 天
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i < data.length; i++) {
    if (data.length > 8 && i % 2 !== 0 && i !== data.length - 1) continue;
    ctx.fillStyle = i === data.length - 1 ? '#F5C97B' : '#8B93A7';
    ctx.fillText(`第${i + 1}天`, X(i), h - padB + 8);
  }

  if (data.length < 2) {
    // 第一天只有一个点
    ctx.fillStyle = cMain;
    ctx.beginPath();
    ctx.arc(X(0), Y(data[0]), 4, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // 面积渐变填充
  const rgb = up ? '255,90,90' : '61,220,151';
  const grad2 = ctx.createLinearGradient(0, padT, 0, h - padB);
  grad2.addColorStop(0, `rgba(${rgb},0.28)`);
  grad2.addColorStop(1, `rgba(${rgb},0)`);
  ctx.beginPath();
  ctx.moveTo(X(0), Y(data[0]));
  for (let i = 1; i < data.length; i++) ctx.lineTo(X(i), Y(data[i]));
  ctx.lineTo(X(data.length - 1), h - padB);
  ctx.lineTo(X(0), h - padB);
  ctx.closePath();
  ctx.fillStyle = grad2;
  ctx.fill();

  // 折线（渐变描边）
  const lineGrad = ctx.createLinearGradient(padL, 0, w - padR, 0);
  lineGrad.addColorStop(0, up ? '#B03A4A' : '#2A8F68');
  lineGrad.addColorStop(1, cMain);
  ctx.beginPath();
  ctx.moveTo(X(0), Y(data[0]));
  for (let i = 1; i < data.length; i++) ctx.lineTo(X(i), Y(data[i]));
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // 数据点
  for (let i = 0; i < data.length; i++) {
    ctx.fillStyle = i === data.length - 1 ? '#F5C97B' : 'rgba(232,234,240,0.7)';
    ctx.beginPath();
    ctx.arc(X(i), Y(data[i]), i === data.length - 1 ? 4.5 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 末端光点 + 当前价标签
  const lx = X(data.length - 1), ly = Y(data[data.length - 1]);
  ctx.shadowColor = 'rgba(245,201,123,0.9)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#F5C97B';
  ctx.beginPath();
  ctx.arc(lx, ly, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.font = 'bold 13px Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#F5C97B';
  ctx.fillText(fmt(data[data.length - 1]), lx + 10, ly);

  // 悬浮十字线 + tooltip
  if (chartHover >= 0 && chartHover < data.length) {
    const hx = X(chartHover), hy = Y(data[chartHover]);
    ctx.strokeStyle = 'rgba(110,143,251,0.45)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(hx, padT);
    ctx.lineTo(hx, h - padB);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(hx, hy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = cMain;
    ctx.lineWidth = 2;
    ctx.stroke();

    const tip = $('#chart-tooltip');
    const prev = chartHover > 0 ? data[chartHover - 1] : null;
    const chgTxt = prev == null ? '首日' :
      ((data[chartHover] - prev) / prev * 100).toFixed(1) + '%';
    const chgCls = prev == null ? '' : (data[chartHover] >= prev ? 'up' : 'down');
    const chgSign = prev != null && data[chartHover] >= prev ? '+' : '';
    tip.innerHTML = `<span class="tt-day">第 ${chartHover + 1} 天</span><br>` +
      `<b>${fmt(data[chartHover])}</b> ` +
      (prev == null ? '' : `<b class="${chgCls}">${chgSign}${chgTxt}</b>`);
    tip.classList.remove('hidden');
    tip.style.left = hx + 'px';
    tip.style.top = (hy - 12) + 'px';
  }
}
