// ========== 主入口：游戏状态与流程 v3 ==========
import { GOODS, initPrices, initHeats, nextDayPrices } from './market.js';
import { maybeTriggerEvent } from './events.js';
import { INTEL_TIERS, buyIntel, rollForecast } from './intel.js';
import { createTracker } from './achievements.js';
import { sfx, toggleMute, isMuted } from './audio.js';
import {
  render, showNews, showSettlement, hideSettlement,
  openModal, isModalOpen, spawnFloat, showToast, updateMuteBtn,
  totalAssets, bagCount, fmt,
} from './ui.js';

const TOTAL_DAYS = 15;
const START_CASH = 5000;
const DEBT = 50000;
const CAPACITY = 20;
const LOAN_DAILY_RATE = 0.05;
const EXPAND_TIERS = [
  { cap: 40,  cost: 2000 },
  { cap: 70,  cost: 6000 },
  { cap: 100, cost: 15000 },
];

const SAVE_KEY = 'fusheng_save_v1';
const BEST_KEY = 'fusheng_best_v1';

let state = newGame();
let tracker = createTracker();
let dayStartAssets = START_CASH;

function newGame() {
  const prices = initPrices();
  const changes = {};
  for (const g of GOODS) changes[g.id] = 0;
  return {
    totalDays: TOTAL_DAYS,
    day: 1,
    cash: START_CASH,
    bank: 0,
    loan: 0,
    debt: DEBT,
    capacity: CAPACITY,
    prices,
    changes,
    bag: {},
    tip: null,
    streaks: {},        // 各商品连跌天数（连跌保护用）
    recentEvents: [],   // 最近触发的事件 id（防重复）
    history: {},        // 各商品每日价格历史（走势图用）
    heats: initHeats(), // 各商品市场热度 0~100
    intel: null,        // 已购买的付费情报
    intelDay: 0,        // 买情报那天（每天限购一次）
    forecast: rollForecast(), // 夜市新闻联播：明日预告
    flash: null,
    over: false,
  };
}

// ---------- 存档 ----------
function save() {
  if (state.over) {
    localStorage.removeItem(SAVE_KEY);
    return;
  }
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    state, ach: tracker.serialize(), dayStartAssets,
  }));
}

function loadBest() {
  return parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
}

// ---------- 成就辅助 ----------
function checkPassive() {
  tracker.onBagChange(state);
  tracker.onBankChange(state);
  tracker.onLoanChange(state);
  for (const ach of tracker.drain()) {
    showToast(ach);
    sfx.ach();
  }
}

// ---------- 买卖 ----------
function buy(id, n) {
  const price = state.prices[id];
  if (state.cash < price * n || bagCount(state) + n > state.capacity) return;
  state.cash -= price * n;
  const item = state.bag[id] || { count: 0, totalCost: 0 };
  item.count += n;
  item.totalCost += price * n;
  state.bag[id] = item;
  sfx.buy();
  spawnFloat(`−${fmt(price * n)}`, 'cost');
  showNews(`你买入了 ${n} 件${nameOf(id)}，单价 ${fmt(price)}。`);
  refresh();
}

function sell(id, n) {
  const item = state.bag[id];
  if (!item || item.count <= 0) return;
  if (n === 'all' || n > item.count) n = item.count;
  const price = state.prices[id];
  const avgCost = item.totalCost / item.count;
  state.cash += price * n;
  item.count -= n;
  item.totalCost -= avgCost * n;
  const diff = (price - avgCost) * n;
  sfx.sell();
  tracker.onSell(diff);
  spawnFloat(`+${fmt(price * n)}`, 'gain');
  showNews(
    `你卖出了 ${n} 件${nameOf(id)}，` +
    (diff >= 0 ? `净赚 ${fmt(diff)}！` : `亏了 ${fmt(-diff)}……`)
  );
  refresh();
}

function nameOf(id) {
  return GOODS.find((g) => g.id === id).name;
}

// ---------- 收摊进入下一天 ----------
function nextDay() {
  if (state.over || isModalOpen()) return;

  if (state.day >= TOTAL_DAYS) {
    settle();
    return;
  }

  state.day += 1;

  if (state.loan > 0) {
    state.loan = Math.round(state.loan * (1 + LOAN_DAILY_RATE));
  }

  const prev = { ...state.prices };
  const { prices, changes, news, streaks, heats } = nextDayPrices(state.prices, state.streaks, state.heats);
  state.prices = prices;
  state.changes = changes;
  state.streaks = streaks;
  state.heats = heats;
  const parts = news.map((n) => n.text);

  // 内幕消息应验（神秘人事件）
  if (state.tip) {
    const g = GOODS.find((x) => x.id === state.tip.id);
    state.prices[g.id] = Math.round(state.prices[g.id] * (1.6 + Math.random() * 0.6));
    state.changes[g.id] = (state.prices[g.id] - prev[g.id]) / prev[g.id];
    parts.push(`🎯 内幕消息应验了！${g.icon}${g.name} 价格暴涨！`);
    state.tip = null;
    tracker.onTipPaid();
  }

  // 付费情报应验
  if (state.intel) {
    const it = state.intel;
    const g = GOODS.find((x) => x.id === it.id);
    if (it.real) {
      state.prices[it.id] = Math.max(1, Math.round(state.prices[it.id] * (1 + it.dir * it.mag)));
      state.changes[it.id] = (state.prices[it.id] - prev[it.id]) / prev[it.id];
      parts.push(`📰 你买的情报应验了！${g.icon}${g.name} 如预期大${it.dir > 0 ? '涨' : '跌'}！`);
    } else {
      parts.push(`📰 昨天买的情报没有应验……看来是条假消息，花钱买了个教训。`);
    }
    state.intel = null;
  }

  // 昨日新闻联播预告应验（75% 概率）
  if (state.forecast && Math.random() < 0.75) {
    const f = state.forecast;
    if (f.type === 'price') {
      const mag = 0.25 + Math.random() * 0.35;
      state.prices[f.id] = Math.max(1, Math.round(state.prices[f.id] * (1 + f.dir * mag)));
      state.changes[f.id] = (state.prices[f.id] - prev[f.id]) / prev[f.id];
    } else {
      state.forceEvent = f.evId;
    }
  }

  // 播报新一天的预告
  state.forecast = rollForecast();
  parts.push(state.forecast.text);

  // 单日资产增长成就
  const gain = totalAssets(state) - dayStartAssets;
  tracker.onDayGain(gain);
  dayStartAssets = totalAssets(state);

  // 随机事件
  const ev = maybeTriggerEvent(state);
  if (!ev) {
    parts.push(`第 ${state.day} 天开始了。仔细看看行情，今天有什么机会？`);
    showNews(parts.join(' '));
    sfx.day();
    refresh();
  } else {
    // 记录事件，2 天内不重复
    state.recentEvents = (state.recentEvents || []).concat(ev.id).slice(-2);
    if (ev.kind === 'passive') {
      parts.push(ev.run(state));
      showNews(parts.join(' '));
      sfx.event();
      refresh();
    } else {
      showNews(parts.join(' '));
      sfx.event();
      refresh();
      openChoiceModal(ev.data, (resultText) => {
        // 神秘人事件结果：被骗 or 拿到真消息
        if (state.scammed) {
          tracker.onTipBought(false);
          delete state.scammed;
        } else if (state.tip) {
          tracker.onTipBought(true);
        }
        showNews(parts.concat([resultText]).join(' '));
        refresh();
      });
    }
  }
}

function openChoiceModal(data, onDone) {
  openModal({
    icon: data.icon,
    title: data.title,
    desc: data.desc,
    options: data.options.map((opt) => ({
      label: opt.label,
      sub: opt.sub,
      disabled: opt.disabled ? opt.disabled(state) : false,
      onPick: () => onDone(opt.run(state)),
    })),
  });
}

// ---------- 银行 ----------
function openBank() {
  openModal({
    icon: '🏦',
    title: '夜市银行',
    desc: `存款不会被偷、不会被罚款，但也没有利息。<br>
      <span class="balance-line">现金 ${fmt(state.cash)} · 存款 ${fmt(state.bank)}</span>`,
    grid: true,
    options: [
      { label: '存 ¥1,000', disabled: state.cash < 1000, act: () => bankOp(1000, 0) },
      { label: '全部存入', sub: fmt(state.cash), disabled: state.cash <= 0, act: () => bankOp(state.cash, 0) },
      { label: '取 ¥1,000', disabled: state.bank < 1000, act: () => bankOp(0, 1000) },
      { label: '全部取出', sub: fmt(state.bank), disabled: state.bank <= 0, act: () => bankOp(0, state.bank) },
      { label: '🚪 返回', sub: '继续摆摊', act: () => {} },
    ].map((o) => ({ label: o.label, sub: o.sub, disabled: o.disabled, onPick: o.act })),
  });
}

function bankOp(deposit, withdraw) {
  if (deposit > 0) {
    state.cash -= deposit;
    state.bank += deposit;
    showNews(`🏦 你存入了 ${fmt(deposit)}，钱在银行里最安全。`);
  } else if (withdraw > 0) {
    state.bank -= withdraw;
    state.cash += withdraw;
    showNews(`🏦 你取出了 ${fmt(withdraw)}。`);
  }
  sfx.buy();
  refresh();
}

// ---------- 借贷 ----------
function openLoan() {
  openModal({
    icon: '💸',
    title: '老王的借贷',
    desc: `日息 5%，收摊时自动复利，随时可以还。高手用它撬动本金，新手被它拖入深渊。<br>
      <span class="balance-line">当前借款 ${fmt(state.loan)} · 现金 ${fmt(state.cash)}</span>`,
    grid: true,
    options: [
      { label: '借 ¥2,000', onPick: () => loanOp(2000, 0) },
      { label: '借 ¥10,000', onPick: () => loanOp(10000, 0) },
      { label: '还 ¥2,000', disabled: state.loan <= 0 || state.cash < 1, onPick: () => loanOp(0, Math.min(2000, state.loan, state.cash)) },
      { label: '全部还清', sub: fmt(state.loan), disabled: state.loan <= 0 || state.cash < 1, onPick: () => loanOp(0, Math.min(state.loan, state.cash)) },
      { label: '🚪 返回', sub: '继续摆摊', onPick: () => {} },
    ],
  });
}

function loanOp(borrow, repay) {
  if (borrow > 0) {
    state.loan += borrow;
    state.cash += borrow;
    tracker.onBorrow();
    spawnFloat(`+${fmt(borrow)}`, 'gain');
    showNews(`💸 你向老王借了 ${fmt(borrow)}。老王笑眯眯地说："不着急还，慢慢来。"`);
  } else if (repay > 0) {
    state.cash -= repay;
    state.loan -= repay;
    showNews(`💸 你还了 ${fmt(repay)} 借款${state.loan > 0 ? `，还剩 ${fmt(state.loan)}` : '，无债一身轻'}。`);
  }
  sfx.buy();
  refresh();
}

// ---------- 背包扩容 ----------
function openExpand() {
  const next = EXPAND_TIERS.find((t) => t.cap > state.capacity);
  if (!next) {
    showNews('🎒 你的背包已经是最大容量了。');
    return;
  }
  openModal({
    icon: '🎒',
    title: '背包扩容',
    desc: `当前容量 ${state.capacity} 格。换个大号行李箱，能装 ${next.cap} 格。<br>
      <span class="balance-line">费用 ${fmt(next.cost)} · 现金 ${fmt(state.cash)}</span>`,
    options: [
      {
        label: `扩容到 ${next.cap} 格`,
        sub: `花费 ${fmt(next.cost)}`,
        disabled: state.cash < next.cost,
        onPick: () => {
          state.cash -= next.cost;
          state.capacity = next.cap;
          spawnFloat(`−${fmt(next.cost)}`, 'cost');
          sfx.buy();
          showNews(`🎒 你换上了大号行李箱，背包扩容到 ${next.cap} 格！`);
          refresh();
        },
      },
      { label: '再想想', sub: '容量还够用', onPick: () => {} },
    ],
  });
}

// ---------- 付费情报 ----------
function openIntel() {
  const boughtToday = state.intelDay === state.day || state.intel !== null;
  openModal({
    icon: '📰',
    title: '情报站',
    desc: `夜市里有的是消息灵通的人——只要你出得起价。买到的情报明天收摊后揭晓真伪。<br>
      <span class="balance-line">现金 ${fmt(state.cash)}${state.intel ? ' · 已持有一条情报' : ''}</span>`,
    options: [
      ...INTEL_TIERS.map((t) => ({
        label: `${t.icon} ${t.name}　<span style="color:var(--gold);font-family:var(--mono)">${fmt(t.cost)}</span>`,
        sub: t.desc,
        disabled: state.cash < t.cost || boughtToday,
        onPick: () => {
          state.cash -= t.cost;
          const { intel, text } = buyIntel(t);
          state.intel = intel;
          state.intelDay = state.day;
          sfx.buy();
          spawnFloat(`−${fmt(t.cost)}`, 'cost');
          showNews(text);
          refresh();
        },
      })),
      { label: '🚪 返回', sub: boughtToday ? '今天已买过情报，明天再来' : '今天先不买', onPick: () => {} },
    ],
  });
}

// ---------- 结算 ----------
function settle() {
  state.over = true;
  const assets = totalAssets(state);
  tracker.onSettle(state, assets);

  // 最高分
  const best = Math.max(loadBest(), assets);
  localStorage.setItem(BEST_KEY, String(best));

  const result = { assets, best, achList: tracker.list() };
  const loanNote = state.loan > 0 ? `（已扣除欠老王的 ${fmt(state.loan)}）` : '';

  if (assets >= 150000) {
    Object.assign(result, {
      emoji: '🏆', title: '商业传奇',
      text: `15 天，从 5,000 元到商业传奇！${loanNote}你的摆摊故事登上了本地新闻头条，房东主动问你要不要合伙开店。`,
    });
  } else if (assets >= 80000) {
    Object.assign(result, {
      emoji: '☀️', title: '小有积蓄',
      text: `还清债务后你还剩下一笔可观的积蓄${loanNote}。你用这笔钱盘下了一个小店面，不用再风吹日晒了。`,
    });
  } else if (assets >= DEBT) {
    Object.assign(result, {
      emoji: '🌧️', title: '勉强还债',
      text: `刚好还清了 50,000 元债务${loanNote}。你长舒一口气，明天还要继续摆摊，但至少今晚能睡个好觉。`,
    });
  } else {
    Object.assign(result, {
      emoji: '💀', title: '破产流浪',
      text: `15 天到了，你没能凑够 50,000 元${loanNote}。房东收走了你的摊位，你在天桥下复盘这一局的每一次失误……`,
    });
  }
  if (assets >= DEBT) sfx.win(); else sfx.lose();
  save();
  showSettlement(result);
}

// ---------- 事件绑定 ----------
function refresh() {
  // 记录当日价格历史（走势图与迷你走势线用），幂等可重复
  if (!state.history) state.history = {};
  for (const g of GOODS) {
    (state.history[g.id] = state.history[g.id] || [])[state.day - 1] = state.prices[g.id];
  }
  render(state);
  checkPassive();
  save();
  setTimeout(() => { state.flash = null; }, 700);
}

function restart() {
  hideSettlement();
  localStorage.removeItem(SAVE_KEY);
  state = newGame();
  tracker = createTracker();
  dayStartAssets = START_CASH;
  showNews(`新的一局开始了。带着 5,000 元本金，15 天内赚到 50,000 元！${state.forecast.text}`);
  refresh();
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn || state.over || isModalOpen()) return;

  const { act, id, n } = btn.dataset;
  if (act === 'buy') buy(id, parseInt(n, 10));
  else if (act === 'sell') sell(id, n === 'all' ? 'all' : parseInt(n, 10));
});

document.querySelector('#btn-next-day').addEventListener('click', nextDay);
document.querySelector('#btn-bank').addEventListener('click', () => { if (!state.over && !isModalOpen()) openBank(); });
document.querySelector('#btn-loan').addEventListener('click', () => { if (!state.over && !isModalOpen()) openLoan(); });
document.querySelector('#btn-expand').addEventListener('click', () => { if (!state.over && !isModalOpen()) openExpand(); });
document.querySelector('#btn-intel').addEventListener('click', () => { if (!state.over && !isModalOpen()) openIntel(); });
document.querySelector('#btn-mute').addEventListener('click', () => updateMuteBtn(toggleMute()));
document.querySelector('#btn-restart').addEventListener('click', restart);

// 调试/测试入口
window.__fusheng = {
  get state() { return state; },
  get tracker() { return tracker; },
};

// ---------- 启动：主页开场 ----------
function hideLanding() {
  document.querySelector('#landing').classList.add('hide');
}

function boot() {
  updateMuteBtn(isMuted());
  render(state); // 主页背后先渲染一帧，但不写存档

  let savedData = null;
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    try { savedData = JSON.parse(raw); }
    catch (e) { localStorage.removeItem(SAVE_KEY); }
  }

  // 有存档时显示“继续摆摊”
  if (savedData) {
    const btn = document.querySelector('#btn-continue');
    btn.classList.remove('hidden');
    btn.textContent = `💾 继续摆摊（第 ${savedData.state.day} 天）`;
    btn.addEventListener('click', () => {
      state = savedData.state;
      // 旧版本存档兼容：补齐新增字段
      if (!state.heats) state.heats = initHeats();
      if (!state.forecast) state.forecast = rollForecast();
      if (state.intel === undefined) state.intel = null;
      if (!state.intelDay) state.intelDay = 0;
      tracker = createTracker(savedData.ach);
      dayStartAssets = savedData.dayStartAssets ?? totalAssets(state);
      hideLanding();
      showNews(`欢迎回来！第 ${state.day} 天，继续你的摆摊生涯。${state.forecast.text}`);
      refresh();
    });
  }

  document.querySelector('#btn-start').addEventListener('click', () => {
    localStorage.removeItem(SAVE_KEY);
    state = newGame();
    tracker = createTracker();
    dayStartAssets = START_CASH;
    hideLanding();
    showNews(`你带着 5,000 元本金来到夜市，15 天内要赚到 50,000 元还债。低买高卖，祝你好运。${state.forecast.text}`);
    sfx.day();
    refresh();
  });
}

boot();
