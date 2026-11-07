// ========== 情报系统：付费分级情报 + 夜市新闻联播 ==========
import { GOODS } from './market.js';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 商品类别提示语（用于模糊情报与新闻联播，不说具体商品名）
export const HINTS = {
  lengmian: '夜市小吃', socks: '服饰小物', case: '手机配件', headset: '数码产品',
  blindbox: '潮流玩具', maotai: '硬通货好酒', sneakers: '潮鞋圈子', gpu: '电脑硬件',
};

// ---------- 付费情报（三档） ----------
export const INTEL_TIERS = [
  { tier: 1, name: '街头传闻', icon: '🗣️', cost: 300,  acc: 0.5, desc: '只说类别和方向，五成把握' },
  { tier: 2, name: '批发内幕', icon: '📦', cost: 1000, acc: 0.7, desc: '指明商品和涨跌方向，七成把握' },
  { tier: 3, name: '核心线报', icon: '🎯', cost: 3000, acc: 0.9, desc: '商品、方向、幅度全都有，九成把握' },
];

// 购买情报：立即生成内容（真伪在购买时已注定，次日揭晓）
export function buyIntel(tier) {
  const g = pick(GOODS);
  const dir = Math.random() < 0.55 ? 1 : -1;
  const mag = tier.tier === 1 ? 0.25 + Math.random() * 0.20
            : tier.tier === 2 ? 0.35 + Math.random() * 0.25
            : 0.50 + Math.random() * 0.40;
  const real = Math.random() < tier.acc;
  const dirTxt = dir > 0 ? '涨' : '跌';

  let text;
  if (tier.tier === 1) {
    text = `🗣️ 街头传闻：听说"${HINTS[g.id]}"明天要${dirTxt}。五成把握，信不信由你。`;
  } else if (tier.tier === 2) {
    text = `📦 批发内幕：明天 ${g.icon}${g.name} 要${dirTxt}。线人说有七成把握。`;
  } else {
    text = `🎯 核心线报：明天 ${g.icon}${g.name} 将大${dirTxt}（幅度 ${Math.round(mag * 100)}% 以上）。九成把握，干票大的。`;
  }

  return { intel: { id: g.id, dir, mag, real, tier: tier.tier }, text };
}

// ---------- 夜市新闻联播（免费模糊预告，75% 应验） ----------
const FORECAST_EVENTS = [
  { evId: 'rain',       text: '📻 夜市新闻联播：气象台发布了暴雨预警，明后两天出摊记得看天。' },
  { evId: 'chengguan',  text: '📻 夜市新闻联播：听说最近市容整治，风声有点紧，大家都警醒着点。' },
  { evId: 'influencer', text: '📻 夜市新闻联播：有小道消息说，某位大网红这两天要来咱们夜市逛。' },
  { evId: 'clearance',  text: '📻 夜市新闻联播：批发市场那边放风，说季末可能要大清仓。' },
];

export function rollForecast() {
  // 60% 预告价格风向，40% 预告事件风向
  if (Math.random() < 0.6) {
    const g = pick(GOODS);
    const dir = Math.random() < 0.55 ? 1 : -1;
    const text = dir > 0
      ? `📻 夜市新闻联播：听说最近${HINTS[g.id]}的行情看涨，已经有人开始悄悄囤货了。`
      : `📻 夜市新闻联播：行家分析，${HINTS[g.id]}的热度可能要退了，囤货需谨慎。`;
    return { type: 'price', id: g.id, dir, text };
  }
  const f = pick(FORECAST_EVENTS);
  return { type: 'event', evId: f.evId, text: f.text };
}
