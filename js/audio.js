// ========== 音效系统：Web Audio 合成，无外部音频文件 ==========

let ctx = null;
let muted = localStorage.getItem('fusheng_muted') === '1';

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur = 0.12, type = 'sine', delay = 0, vol = 0.14) {
  if (muted) return;
  try {
    const a = ac();
    const t = a.currentTime + delay;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch (e) { /* 音频不可用时静默失败 */ }
}

export const sfx = {
  buy()   { tone(660, 0.08, 'triangle'); },
  sell()  { tone(880, 0.09, 'triangle'); tone(1318, 0.12, 'triangle', 0.08); },
  day()   { tone(440, 0.07, 'sine'); tone(550, 0.09, 'sine', 0.07); },
  event() { tone(520, 0.10, 'square', 0, 0.07); tone(780, 0.14, 'square', 0.10, 0.07); },
  ach()   { tone(1046, 0.10, 'sine'); tone(1318, 0.16, 'sine', 0.10); },
  win()   { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.20, 'triangle', i * 0.13)); },
  lose()  { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.22, 'sawtooth', i * 0.16, 0.07)); },
};

export function toggleMute() {
  muted = !muted;
  localStorage.setItem('fusheng_muted', muted ? '1' : '0');
  return muted;
}

export function isMuted() {
  return muted;
}
