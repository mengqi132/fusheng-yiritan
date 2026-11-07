// ========== 行情系统：商品定义与价格算法 ==========

// 商品表：分平价 / 中档 / 高档三档，波动幅度递增
export const GOODS = [
  { id: 'lengmian', name: '烤冷面',   icon: '🍜', base: 15,   vol: 0.15 },
  { id: 'socks',    name: '潮袜',     icon: '🧦', base: 12,   vol: 0.15 },
  { id: 'case',     name: '手机壳',   icon: '📱', base: 35,   vol: 0.15 },
  { id: 'headset',  name: '蓝牙耳机', icon: '🎧', base: 260,  vol: 0.30 },
  { id: 'blindbox', name: '盲盒手办', icon: '🎁', base: 420,  vol: 0.30 },
  { id: 'maotai',   name: '茅台酒',   icon: '🍶', base: 2800, vol: 0.50 },
  { id: 'sneakers', name: '限量球鞋', icon: '👟', base: 3200, vol: 0.50 },
  { id: 'gpu',      name: '显卡',     icon: '🖥️', base: 6800, vol: 0.50 },
];

// 开局首日价格：在基准价附近抖动
export function initPrices() {
  const prices = {};
  for (const g of GOODS) {
    prices[g.id] = jitter(g.base, g.vol);
  }
  return prices;
}

// 开局热度：40~60 之间
export function initHeats() {
  const heats = {};
  for (const g of GOODS) {
    heats[g.id] = 40 + Math.round(Math.random() * 20);
  }
  return heats;
}

function jitter(value, vol) {
  const r = 1 + (Math.random() * 2 - 1) * vol;
  return Math.max(1, Math.round(value * r));
}

// 次日价格：随机波动 + 热度偏置 + 均值回归 + 小概率暴涨暴跌 + 连跌保护
// 热度（0~100）：越高越容易涨，是玩家可观察的"趋势指标"
// 返回 { prices, changes, news, streaks, heats }
export function nextDayPrices(prev, streaks = {}, heats = {}) {
  const prices = {};
  const changes = {};
  const outNews = [];
  const newStreaks = {};
  const newHeats = {};

  for (const g of GOODS) {
    const old = prev[g.id];
    const heat = heats[g.id] ?? 50;

    // 均值回归：偏离基准价越多，回拉越强
    const pull = ((g.base - old) / g.base) * 0.09;
    // 热度偏置：热度 50 为中性，越高越容易涨、越低越容易跌
    const heatBias = ((heat - 50) / 50) * g.vol * 0.35;
    let change = (Math.random() * 2 - 1) * g.vol + pull + heatBias;

    // 3.5% 概率暴涨，3.5% 概率暴跌（幅度收敛），并生成快讯
    const roll = Math.random();
    if (roll < 0.035) {
      change += 0.8 + Math.random() * 0.8;
      outNews.push({ icon: '📈', text: `${g.icon} ${g.name} 突然爆火，行情一夜飙升！` });
    } else if (roll > 0.965) {
      change -= 0.35 + Math.random() * 0.25;
      outNews.push({ icon: '📉', text: `${g.icon} ${g.name} 无人问津，行情大幅跳水。` });
    }

    // 连跌保护：连跌 2 天后，第 3 天保底反弹，不再阴跌
    const underProtection = (streaks[g.id] || 0) >= 2;
    if (underProtection) {
      change = Math.abs(change) * 0.5 + g.vol * 0.45;
    }

    let price = Math.max(1, Math.round(old * (1 + change)));
    // 保底价（¥1）附近四舍五入会吃掉涨幅，保护期强制至少 +1
    if (underProtection && price <= old) price = old + 1;
    prices[g.id] = price;
    changes[g.id] = (price - old) / old;
    newStreaks[g.id] = changes[g.id] < -0.02 ? (streaks[g.id] || 0) + 1 : 0;

    // 热度演化：跟涨跟跌 + 噪声 + 向 50 缓慢回归
    newHeats[g.id] = Math.max(0, Math.min(100, Math.round(
      heat + changes[g.id] * 120 + (Math.random() * 16 - 8) + (50 - heat) * 0.08
    )));
  }

  return { prices, changes, news: outNews, streaks: newStreaks, heats: newHeats };
}
