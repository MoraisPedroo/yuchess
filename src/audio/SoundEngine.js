/* SoundEngine.js — efeitos sonoros cartoon sintetizados com Web Audio (sem ficheiros de som).
   Presets do relatório: chess_move, sword_draw, spring_jump, ice_freeze, explosion_bam, shield_clang,
   negate_stamp, magic_zap, card_flip, gacha_tear, victory_fanfare (+ alguns extra para a interface). */
(function (YC) {
  'use strict';

  const Sound = {
    ctx: null, master: null, muted: false, volume: 0.55,

    init() {
      if (Sound.ctx) return Sound.ctx.state === 'suspended' ? Sound.ctx.resume().catch(() => {}) : Promise.resolve();
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return Promise.resolve();
      Sound.ctx = new AC();
      Sound.master = Sound.ctx.createGain();
      Sound.master.gain.value = Sound.muted ? 0 : Sound.volume;
      const comp = Sound.ctx.createDynamicsCompressor();
      Sound.master.connect(comp).connect(Sound.ctx.destination);
      return Promise.race([Sound.ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 300))]);
    },

    setMuted(m) {
      Sound.muted = m;
      if (Sound.master) Sound.master.gain.value = m ? 0 : Sound.volume;
      try { localStorage.setItem('chessgioh.muted', m ? '1' : '0'); } catch (e) { /* sem armazenamento */ }
    },

    ready() { return Sound.ctx && Sound.ctx.state === 'running' && !Sound.muted; },

    tone({ type = 'sine', f = 440, f2 = null, t = 0, dur = 0.15, vol = 0.4, attack = 0.005, curve = 'exp' }) {
      const c = Sound.ctx, now = c.currentTime + t;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, now);
      if (f2) (curve === 'lin' ? o.frequency.linearRampToValueAtTime(f2, now + dur) : o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), now + dur));
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(vol, now + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o.connect(g).connect(Sound.master);
      o.start(now); o.stop(now + dur + 0.05);
      return o;
    },

    noise({ t = 0, dur = 0.2, vol = 0.3, type = 'lowpass', f = 1200, f2 = null, q = 0.8 }) {
      const c = Sound.ctx, now = c.currentTime + t;
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(); src.buffer = buf;
      const fl = c.createBiquadFilter(); fl.type = type; fl.Q.value = q;
      fl.frequency.setValueAtTime(f, now);
      if (f2) fl.frequency.exponentialRampToValueAtTime(f2, now + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(fl).connect(g).connect(Sound.master);
      src.start(now); src.stop(now + dur + 0.05);
    },

    play(name) {
      if (!Sound.ready()) return;
      const fn = Sound.presets[name];
      if (fn) try { fn(); } catch (err) { /* som não é essencial */ }
    },

    presets: {
      chess_move() { Sound.noise({ dur: 0.05, vol: 0.35, type: 'bandpass', f: 1800, q: 2 }); Sound.tone({ type: 'triangle', f: 520, f2: 760, dur: 0.09, vol: 0.25 }); },
      hop() { Sound.tone({ type: 'sine', f: 380, f2: 720, dur: 0.12, vol: 0.18 }); },
      capture() { Sound.noise({ dur: 0.18, vol: 0.5, f: 900, f2: 200 }); Sound.tone({ type: 'square', f: 220, f2: 70, dur: 0.22, vol: 0.22 }); },
      sword_draw() { Sound.noise({ dur: 0.35, vol: 0.25, type: 'highpass', f: 2500, f2: 7000 }); Sound.tone({ type: 'sawtooth', f: 900, f2: 1800, dur: 0.3, vol: 0.08 }); Sound.tone({ f: 2400, t: 0.25, dur: 0.4, vol: 0.12 }); },
      spring_jump() { const o = Sound.tone({ type: 'sine', f: 180, f2: 620, dur: 0.35, vol: 0.35, curve: 'lin' }); if (o) { const lfo = Sound.ctx.createOscillator(), lg = Sound.ctx.createGain(); lfo.frequency.value = 22; lg.gain.value = 60; lfo.connect(lg).connect(o.frequency); lfo.start(); lfo.stop(Sound.ctx.currentTime + 0.4); } },
      ice_freeze() { [1568, 2093, 2637, 3136].forEach((f, i) => Sound.tone({ type: 'triangle', f, t: i * 0.05, dur: 0.35, vol: 0.12 })); Sound.noise({ dur: 0.5, vol: 0.15, type: 'highpass', f: 4000 }); },
      explosion_bam() { Sound.noise({ dur: 0.6, vol: 0.7, f: 1600, f2: 80 }); Sound.tone({ type: 'sine', f: 120, f2: 40, dur: 0.5, vol: 0.6 }); },
      shield_clang() { [523, 1187, 1873, 2711].forEach((f, i) => Sound.tone({ type: 'sine', f, dur: 0.9 - i * 0.15, vol: 0.16 })); Sound.noise({ dur: 0.08, vol: 0.4, type: 'bandpass', f: 3000, q: 3 }); },
      glass() { [2400, 3100, 3900, 2700, 4500].forEach((f, i) => Sound.tone({ type: 'triangle', f, t: i * 0.035, dur: 0.25, vol: 0.12 })); Sound.noise({ dur: 0.25, vol: 0.3, type: 'highpass', f: 3500 }); },
      negate_stamp() { Sound.tone({ type: 'sine', f: 90, f2: 45, dur: 0.3, vol: 0.7 }); Sound.noise({ dur: 0.15, vol: 0.5, f: 600 }); Sound.tone({ type: 'square', f: 140, t: 0.05, dur: 0.35, vol: 0.12 }); },
      magic_zap() { Sound.tone({ type: 'sawtooth', f: 300, f2: 1600, dur: 0.25, vol: 0.12 }); Sound.tone({ type: 'sine', f: 1200, f2: 2400, t: 0.08, dur: 0.3, vol: 0.15 }); },
      card_flip() { Sound.noise({ dur: 0.09, vol: 0.3, type: 'bandpass', f: 2600, f2: 900, q: 1.2 }); },
      card_draw() { Sound.noise({ dur: 0.14, vol: 0.22, type: 'bandpass', f: 1200, f2: 3200, q: 1 }); Sound.tone({ f: 880, t: 0.08, dur: 0.1, vol: 0.08 }); },
      gacha_tear() { Sound.noise({ dur: 0.45, vol: 0.45, type: 'bandpass', f: 800, f2: 4200, q: 0.7 }); },
      victory_fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => Sound.tone({ type: 'square', f, t: i * 0.12, dur: i === 5 ? 0.6 : 0.16, vol: 0.14 })); },
      defeat() { [392, 370, 349, 262].forEach((f, i) => Sound.tone({ type: 'triangle', f, t: i * 0.22, dur: 0.3, vol: 0.2 })); },
      trap() { Sound.tone({ type: 'square', f: 880, dur: 0.08, vol: 0.18 }); Sound.tone({ type: 'square', f: 660, t: 0.09, dur: 0.08, vol: 0.18 }); Sound.noise({ t: 0.15, dur: 0.3, vol: 0.4, f: 1500, f2: 300 }); },
      check() { [0, 0.18].forEach((t) => Sound.tone({ type: 'square', f: 988, t, dur: 0.12, vol: 0.14 })); },
      click() { Sound.tone({ type: 'triangle', f: 660, f2: 990, dur: 0.06, vol: 0.12 }); },
      turn() { Sound.tone({ type: 'sine', f: 587, dur: 0.12, vol: 0.15 }); Sound.tone({ type: 'sine', f: 880, t: 0.1, dur: 0.18, vol: 0.15 }); },
      error() { Sound.tone({ type: 'square', f: 180, f2: 140, dur: 0.15, vol: 0.12 }); },
      reveal_rare() { [784, 988, 1175].forEach((f, i) => Sound.tone({ type: 'triangle', f, t: i * 0.07, dur: 0.25, vol: 0.14 })); },
      reveal_epic() { [659, 831, 988, 1319].forEach((f, i) => Sound.tone({ type: 'triangle', f, t: i * 0.07, dur: 0.35, vol: 0.16 })); Sound.presets.magic_zap(); },
      reveal_legend() { Sound.presets.victory_fanfare(); Sound.noise({ dur: 1.2, vol: 0.15, type: 'highpass', f: 5000 }); }
    }
  };

  try { Sound.muted = localStorage.getItem('chessgioh.muted') === '1'; } catch (e) { /* sem armazenamento */ }
  YC.Sound = Sound;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
