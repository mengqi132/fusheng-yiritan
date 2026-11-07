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

function jitter(value, vol) {
  const r = 1 + (Math.random() * 2 - 1) * vol;
  return Math.max(1, Math.round(value * r));
}

// 次日价格：随机波动 + 均值回归 + 小概率暴涨暴跌
// 返回 { prices, changes, news }
export function nextDayPrices(prev) {
  const prices = {};
  const changes = {};
  const news = [];

  for (const g of GOODS) {
    const old = prev[g.id];

    // 均值回归：偏离基准价越多，回拉越强
    const pull = ((g.base - old) / g.base) * 0.06;
    let change = (Math.random() * 2 - 1) * g.vol + pull;

    // 5% 概率暴涨，5% 概率暴跌，并生成快讯
    const roll = Math.random();
    if (roll < 0.05) {
      change += 0.8 + Math.random() * 0.8;
      news.push({ icon: '📈', text: `${g.icon} ${g.name} 突然爆火，行情一夜飙升！` });
    } else if (roll > 0.95) {
      change -= 0.5 + Math.random() * 0.3;
      news.push({ icon: '📉', text: `${g.icon} ${g.name} 无人问津，行情大幅跳水。` });
    }

    const price = Math.max(1, Math.round(old * (1 + change)));
    prices[g.id] = price;
    changes[g.id] = (price - old) / old;
  }

  return { prices, changes, news };
}
