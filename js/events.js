// ========== 随机事件系统 ==========
// 两类事件：passive（直接发生，返回快讯文案）
//           choice（弹出抉择窗口，两个选项各带结果）
import { GOODS } from './market.js';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const fmt = (n) => '¥' + Math.round(n).toLocaleString('zh-CN');

const heldIds = (state) => Object.keys(state.bag).filter((id) => state.bag[id].count > 0);

// ---------- 事件库 ----------
const EVENTS = [
  // ===== 被动事件 =====
  {
    id: 'chengguan',
    kind: 'passive',
    cond: (s) => s.cash > 200,
    run(state) {
      const fine = Math.round(state.cash * 0.10);
      state.cash -= fine;
      return `👮 城管突击检查！你来不及收摊，被罚款 ${fmt(fine)}。`;
    },
  },
  {
    id: 'thief',
    kind: 'passive',
    cond: (s) => s.cash > 500,
    run(state) {
      const loss = Math.round(state.cash * 0.20);
      state.cash -= loss;
      return `🥷 收摊时发现钱包被划开了，损失现金 ${fmt(loss)}。（存在银行的钱是安全的）`;
    },
  },
  {
    id: 'card',
    kind: 'passive',
    run(state) {
      const gain = randInt(300, 800);
      state.cash += gain;
      return `💳 你在摊位底下捡到一张购物卡，转手卖了 ${fmt(gain)}！`;
    },
  },
  {
    id: 'fellow',
    kind: 'passive',
    run(state) {
      state.cash += 1000;
      return `🧧 多年不见的老乡路过摊位，还了你 ${fmt(1000)} 旧账。`;
    },
  },
  {
    id: 'influencer',
    kind: 'passive',
    run(state) {
      const g = pick(GOODS);
      state.prices[g.id] = Math.max(1, Math.round(state.prices[g.id] * 1.5));
      return `📸 网红来夜市打卡，${g.icon}${g.name} 被带火了，价格应声大涨！`;
    },
  },
  {
    id: 'clearance',
    kind: 'passive',
    run(state) {
      const g = pick(GOODS);
      state.prices[g.id] = Math.max(1, Math.round(state.prices[g.id] * 0.6));
      return `🏷️ 批发市场季末清仓，${g.icon}${g.name} 进货价大跳水！`;
    },
  },
  {
    id: 'rain',
    kind: 'passive',
    run(state) {
      const g = pick(GOODS);
      state.prices[g.id] = Math.max(1, Math.round(state.prices[g.id] * 0.8));
      return `🌧️ 暴雨突至，夜市客流锐减，${g.icon}${g.name} 只能降价处理。`;
    },
  },

  // ===== 抉择事件 =====
  {
    id: 'insider',
    kind: 'choice',
    build() {
      return {
        icon: '🕵️',
        title: '神秘人的内幕消息',
        desc: '一个戴鸭舌帽的男人凑过来："给我 ¥1,000，告诉你明天什么会涨。信不信由你。"',
        options: [
          {
            label: '花 ¥1,000 买消息',
            sub: '70% 是真消息，30% 被骗',
            disabled: (s) => s.cash < 1000,
            run(state) {
              state.cash -= 1000;
              if (Math.random() < 0.7) {
                const g = pick(GOODS);
                state.tip = { id: g.id };
                return `🤫 你买下了消息：明天 ${g.icon}${g.name} 会大涨。是真是假，明天见分晓。`;
              }
              state.scammed = true;
              return `😤 你被骗了！那人收了钱就消失在巷子里，所谓消息一文不值。`;
            },
          },
          {
            label: '转身离开',
            sub: '不冒这个险',
            run() {
              return '🚶 你没有理会他。夜市里真真假假，守住本金最重要。';
            },
          },
        ],
      };
    },
  },
  {
    id: 'drunk',
    kind: 'choice',
    cond: (s) => heldIds(s).length > 0,
    build(state) {
      const id = pick(heldIds(state));
      const g = GOODS.find((x) => x.id === id);
      const item = state.bag[id];
      const offer = Math.round(state.prices[id] * 1.5 * item.count);
      return {
        icon: '🍺',
        title: '醉汉高价收货',
        desc: `一个醉醺醺的男人拍着桌子，要用 1.5 倍价钱收下你全部的 ${g.icon}${g.name}（共 ${fmt(offer)}）。`,
        options: [
          {
            label: `成交，收 ${fmt(offer)}`,
            sub: '立刻卖出全部该商品',
            run(state) {
              state.cash += offer;
              state.bag[id] = { count: 0, totalCost: 0 };
              return `🤝 成交！醉汉抱着 ${item.count} 件${g.name} 摇摇晃晃地走了，你净赚一笔差价。`;
            },
          },
          {
            label: '拒绝',
            sub: '怕他酒醒后反悔',
            run() {
              return '🙅 你婉拒了这笔买卖。醉汉嘟囔着走开了。';
            },
          },
        ],
      };
    },
  },
  {
    id: 'wholesale',
    kind: 'choice',
    build(state) {
      const g = pick(GOODS);
      const n = 5;
      const cost = Math.round(state.prices[g.id] * 0.6 * n);
      return {
        icon: '🚚',
        title: '批发商深夜推销',
        desc: `一辆小货车停在摊前："${g.icon}${g.name} 六折处理，${n} 件一共 ${fmt(cost)}，要不要？"`,
        options: [
          {
            label: `花 ${fmt(cost)} 买下`,
            sub: `${n} 件，约为市价六折`,
            disabled: (s) => s.cash < cost || bagCount(s) + n > s.capacity,
            run(state) {
              state.cash -= cost;
              const item = state.bag[g.id] || { count: 0, totalCost: 0 };
              item.count += n;
              item.totalCost += cost;
              state.bag[g.id] = item;
              return `📦 你囤下了 ${n} 件${g.name}，均价只有市价的六折。`;
            },
          },
          {
            label: '婉拒',
            sub: '背包或现金有限',
            run() {
              return '🚚 货车发动，消失在夜色里。';
            },
          },
        ],
      };
    },
  },
];

function bagCount(state) {
  let n = 0;
  for (const id in state.bag) n += state.bag[id].count;
  return n;
}

// 每天收摊后调用：55% 概率触发一个满足条件的事件
// 同一事件 2 天内不会重复出现，保证事件多样性
export function maybeTriggerEvent(state) {
  if (Math.random() > 0.55) return null;
  const recent = state.recentEvents || [];
  let pool = EVENTS.filter((e) => !recent.includes(e.id) && (!e.cond || e.cond(state)));
  if (pool.length === 0) {
    pool = EVENTS.filter((e) => !e.cond || e.cond(state));
  }
  if (pool.length === 0) return null;
  const ev = pick(pool);
  return ev.kind === 'choice' ? { ...ev, data: ev.build(state) } : ev;
}
