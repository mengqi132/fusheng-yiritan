// ========== 成就系统 ==========

export const ACH_DEFS = {
  first_pot: { icon: '🎯', name: '第一桶金', desc: '单笔卖出净赚 ¥1,000 以上' },
  day_rich:  { icon: '💰', name: '日进斗金', desc: '单日总资产增长 ¥10,000 以上' },
  gpu_king:  { icon: '🖥️', name: '满仓显卡', desc: '同时持有 5 张以上显卡' },
  insider:   { icon: '🤫', name: '消息灵通', desc: '买到的内幕消息成功应验' },
  sucker:    { icon: '😤', name: '冤大头',   desc: '被神秘人骗过一次' },
  saver:     { icon: '🏦', name: '理财达人', desc: '银行存款达到 ¥20,000' },
  leverage:  { icon: '💸', name: '杠杆玩家', desc: '借款达到 ¥10,000' },
  clean:     { icon: '🛡️', name: '白手起家', desc: '从不借款并成功还债' },
  legend:    { icon: '👑', name: '商业传奇', desc: '达成商业传奇结局' },
};

// 追踪器：记录解锁状态与过程标记，支持存档序列化
export function createTracker(saved) {
  const unlocked = new Set(saved?.unlocked || []);
  const flags = { borrowed: false, tipPending: false, ...(saved?.flags || {}) };
  let newly = [];

  function unlock(id) {
    if (!unlocked.has(id) && ACH_DEFS[id]) {
      unlocked.add(id);
      newly.push(ACH_DEFS[id]);
    }
  }

  return {
    flags,
    unlocked,

    onSell(profit) { if (profit >= 1000) unlock('first_pot'); },
    onDayGain(gain) { if (gain >= 10000) unlock('day_rich'); },
    onBagChange(state) { if ((state.bag.gpu?.count || 0) >= 5) unlock('gpu_king'); },
    onBankChange(state) { if (state.bank >= 20000) unlock('saver'); },
    onLoanChange(state) { if (state.loan >= 10000) unlock('leverage'); },
    onBorrow() { flags.borrowed = true; },
    onTipBought(success) { if (success) flags.tipPending = true; else unlock('sucker'); },
    onTipPaid() { if (flags.tipPending) { unlock('insider'); flags.tipPending = false; } },
    onSettle(state, assets) {
      if (assets >= 150000) unlock('legend');
      if (!flags.borrowed && assets >= state.debt) unlock('clean');
    },

    // 取出本次新解锁的成就（用于弹提示）
    drain() { const n = newly; newly = []; return n; },
    serialize() { return { unlocked: [...unlocked], flags }; },
    list() { return [...unlocked].map((id) => ACH_DEFS[id]); },
  };
}
