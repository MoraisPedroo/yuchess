/* VintageAudioSynth.js — som 100% procedural com Web Audio API (zero MP3/WAV):
   chiado de gramofone, jazz swing a 124 BPM (contrabaixo walking + escovas + ride + piano),
   e SFX cartunescos (boing, apito descendente, bigorna FM, fanfarra de metais). */
(function (YC) {
  'use strict';

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  // Progressão de 8 compassos em Bb (ragtime/swing): Bb6 G7 Cm7 F7 | Bb6 Eb7 F7 Bb6
  const CHORDS = [
    { root: 46, tones: [0, 4, 7, 9] }, { root: 43, tones: [0, 4, 7, 10] }, { root: 48, tones: [0, 3, 7, 10] }, { root: 41, tones: [0, 4, 7, 10] },
    { root: 46, tones: [0, 4, 7, 9] }, { root: 51, tones: [0, 4, 7, 10] }, { root: 41, tones: [0, 4, 7, 10] }, { root: 46, tones: [0, 4, 7, 9] }
  ];

  class VintageAudioSynth {
    constructor() {
      this.ctx = null;
      this.musicOn = true;
      this.sfxOn = true;
      this.timer = null;
    }

    /** Tem de ser chamado num gesto do utilizador (botão INSERT COIN). */
    async init() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        const c = this.ctx;
        this.comp = c.createDynamicsCompressor();
        this.comp.threshold.value = -16; this.comp.ratio.value = 4;
        this.master = c.createGain(); this.master.gain.value = 0.8;
        this.music = c.createGain(); this.music.gain.value = this.musicOn ? 0.5 : 0;
        this.sfx = c.createGain(); this.sfx.gain.value = this.sfxOn ? 0.9 : 0;
        // "corneta de gramofone": banda passante suave em toda a música
        this.horn = c.createBiquadFilter(); this.horn.type = 'peaking'; this.horn.frequency.value = 1100; this.horn.Q.value = 0.9; this.horn.gain.value = 5;
        this.lowcut = c.createBiquadFilter(); this.lowcut.type = 'highpass'; this.lowcut.frequency.value = 70;
        this.music.connect(this.horn).connect(this.lowcut).connect(this.comp);
        this.sfx.connect(this.comp);
        this.comp.connect(this.master).connect(c.destination);
        this.noiseBuf = this.makeNoise(1.5);
      }
      // Sem gesto válido o resume() pode nunca resolver: o jogo arranca mudo em vez de ficar parado.
      if (this.ctx.state !== 'running') await Promise.race([this.ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 400))]);
      return this.ctx.state === 'running';
    }

    get ready() { return !!this.ctx && this.ctx.state === 'running'; }

    makeNoise(seconds) {
      const c = this.ctx, buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    }

    setMusic(on) { this.musicOn = on; if (this.music) this.music.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.1); }
    setSfx(on) { this.sfxOn = on; if (this.sfx) this.sfx.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05); }

    // ── Textura de vinil 78 RPM ──
    startGramophoneAmbience() {
      if (!this.ready || this.vinyl) return;
      const c = this.ctx, len = c.sampleRate * 3, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const pop = Math.random() > 0.9985 ? (Math.random() * 2 - 1) * 0.6 : 0;
        d[i] = (Math.random() * 2 - 1) * 0.035 + pop;
      }
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 1.8;
      const g = c.createGain(); g.gain.value = 0.35;
      src.connect(bp).connect(g).connect(this.music);
      src.start();
      this.vinyl = src;
    }

    // ── Sequenciador de jazz swing ──
    startSwingLoop(bpm = 124) {
      if (!this.ready || this.timer) return;
      this.bpm = bpm;
      this.beatDur = 60 / bpm;
      this.nextBeat = this.ctx.currentTime + 0.1;
      this.beatIdx = 0;
      this.timer = setInterval(() => this.schedule(), 25);
    }

    stopSwingLoop() { clearInterval(this.timer); this.timer = null; }

    schedule() {
      const c = this.ctx;
      while (this.nextBeat < c.currentTime + 0.12) {
        const t = this.nextBeat, b = this.beatIdx, bar = Math.floor(b / 4) % 8, beat = b % 4;
        const ch = CHORDS[bar], next = CHORDS[(bar + 1) % 8];
        // walking bass: fundamental, terça/quinta, sexta, nota de aproximação cromática
        let note = ch.root - 12;
        if (beat === 1) note += ch.tones[1];
        if (beat === 2) note += ch.tones[2];
        if (beat === 3) note = next.root - 12 + (Math.random() < 0.5 ? -1 : 1);
        this.bass(t, midi(note));
        const swing = this.beatDur * (2 / 3);
        this.ride(t, 0.07);
        if (beat === 1 || beat === 3) { this.brush(t); this.ride(t + swing, 0.045); }
        if ((beat === 1 || beat === 3) && Math.random() < 0.75) this.piano(t + swing, ch, 0.05);
        if (beat === 0 && bar % 2 === 0 && Math.random() < 0.6) this.piano(t, ch, 0.04);
        this.nextBeat += this.beatDur;
        this.beatIdx++;
      }
    }

    bass(t, f) {
      const c = this.ctx, g = c.createGain(), lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 320;
      const o1 = c.createOscillator(); o1.type = 'triangle'; o1.frequency.value = f;
      const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f / 2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.55, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.29);
      o1.connect(lp); o2.connect(lp); lp.connect(g).connect(this.music);
      o1.start(t); o2.start(t); o1.stop(t + 0.32); o2.stop(t + 0.32);
    }

    noiseHit(t, { dur = 0.1, gain = 0.2, type = 'highpass', freq = 1800, q = 0.7, dest } = {}) {
      const c = this.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = this.noiseBuf;
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(dest || this.sfx);
      src.start(t, Math.random() * 0.5, dur + 0.05);
    }

    brush(t) { this.noiseHit(t, { dur: 0.16, gain: 0.16, freq: 1800, dest: this.music }); }
    ride(t, gain) { this.noiseHit(t, { dur: 0.09, gain, type: 'highpass', freq: 7000, dest: this.music }); }

    piano(t, ch, gain) {
      const c = this.ctx;
      ch.tones.slice(1).forEach((iv, i) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'triangle'; o.frequency.value = midi(ch.root + 12 + iv);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.006 + i * 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(g).connect(this.music);
        o.start(t); o.stop(t + 0.25);
      });
    }

    // ── SFX ──
    tone({ type = 'sine', f0, f1, dur, gain = 0.3, at = 0, curve = 'exp', vibrato = 0, vibratoDepth = 0 }) {
      if (!this.ready) return;
      const c = this.ctx, t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1) curve === 'exp' ? o.frequency.exponentialRampToValueAtTime(f1, t + dur) : o.frequency.linearRampToValueAtTime(f1, t + dur);
      if (vibrato) {
        const l = c.createOscillator(), lg = c.createGain();
        l.frequency.value = vibrato; lg.gain.value = vibratoDepth;
        l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + 0.05);
      }
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.sfx);
      o.start(t); o.stop(t + dur + 0.05);
    }

    playJumpBoing() { this.tone({ f0: 150, f1: 600, dur: 0.25, gain: 0.22, vibrato: 25, vibratoDepth: 30 }); }
    playSlideWhistleDown() { this.tone({ f0: 950, f1: 140, dur: 0.32, gain: 0.2, vibrato: 7, vibratoDepth: 12 }); }
    playThud() { if (this.ready) this.noiseHit(this.ctx.currentTime, { dur: 0.12, gain: 0.35, type: 'lowpass', freq: 400 }); }
    playPunch() {
      if (!this.ready) return;
      this.tone({ type: 'square', f0: 180, f1: 60, dur: 0.12, gain: 0.18 });
      this.noiseHit(this.ctx.currentTime, { dur: 0.07, gain: 0.3, type: 'bandpass', freq: 900, q: 1.2 });
    }

    /** Bigorna: síntese FM metálica + estalido de ruído. */
    playAnvilHit() {
      if (!this.ready) return;
      const c = this.ctx, t = c.currentTime;
      const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
      car.type = 'square'; car.frequency.value = 420;
      mod.type = 'sawtooth'; mod.frequency.value = 587; mg.gain.value = 900;
      mod.connect(mg).connect(car.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      car.connect(g).connect(this.sfx);
      car.start(t); mod.start(t); car.stop(t + 0.5); mod.stop(t + 0.5);
      this.noiseHit(t, { dur: 0.08, gain: 0.45, type: 'bandpass', freq: 2500, q: 0.8 });
    }

    playExplosion() {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      this.noiseHit(t, { dur: 0.6, gain: 0.5, type: 'lowpass', freq: 600 });
      this.tone({ type: 'sine', f0: 120, f1: 40, dur: 0.4, gain: 0.35 });
    }

    /** Acorde de Big Band: 3 dentes de serra desafinados com filtro "wah" a abrir. */
    playBrassParryFanfare() {
      if (!this.ready) return;
      const c = this.ctx, t = c.currentTime;
      const chord = [midi(65), midi(69), midi(72), midi(75)];
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6;
      lp.frequency.setValueAtTime(300, t);
      lp.frequency.exponentialRampToValueAtTime(2800, t + 0.08);
      lp.frequency.exponentialRampToValueAtTime(900, t + 0.7);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.03);
      g.gain.setValueAtTime(0.16, t + 0.45);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      lp.connect(g).connect(this.sfx);
      chord.forEach((f, i) => [-7, 0, 7].forEach((det) => {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det + i;
        o.connect(lp); o.start(t); o.stop(t + 0.95);
      }));
    }

    playFanfareShort() {
      [72, 76, 79, 84].forEach((n, i) => this.tone({ type: 'sawtooth', f0: midi(n), dur: 0.16, gain: 0.08, at: i * 0.09 }));
    }

    playVictory() {
      [60, 64, 67, 72, 67, 72, 76, 79].forEach((n, i) => this.tone({ type: 'square', f0: midi(n), dur: 0.2, gain: 0.07, at: i * 0.13 }));
      setTimeout(() => this.playBrassParryFanfare(), 1100);
    }

    /** Trombone "wah-wah-wah-waaah" de derrota. */
    playDefeat() {
      [62, 61, 60, 59].forEach((n, i) => this.tone({ type: 'sawtooth', f0: midi(n), f1: midi(n) * (i === 3 ? 0.94 : 1), dur: i === 3 ? 1.1 : 0.45, gain: 0.09, at: i * 0.5, vibrato: i === 3 ? 6 : 0, vibratoDepth: 6, curve: 'lin' }));
    }

    playTrapSpring() { this.tone({ type: 'triangle', f0: 700, f1: 220, dur: 0.35, gain: 0.2, vibrato: 30, vibratoDepth: 80 }); }
    playHeal() { [72, 76, 79, 84].forEach((n, i) => this.tone({ type: 'sine', f0: midi(n), dur: 0.18, gain: 0.12, at: i * 0.06 })); }
    playPowerUp() { this.tone({ type: 'square', f0: 330, f1: 990, dur: 0.18, gain: 0.07 }); }
    playFreeze() { [96, 91, 98].forEach((n, i) => this.tone({ type: 'sine', f0: midi(n), dur: 0.2, gain: 0.08, at: i * 0.05 })); }
    playCardFlip() { if (this.ready) this.noiseHit(this.ctx.currentTime, { dur: 0.06, gain: 0.25, type: 'bandpass', freq: 3200, q: 1.5 }); }
    playCardSet() { this.playThud(); this.tone({ type: 'triangle', f0: 220, f1: 180, dur: 0.12, gain: 0.12 }); }
    playChainBell(n = 1) { this.tone({ type: 'sine', f0: midi(76 + n * 3), dur: 0.5, gain: 0.16 }); this.tone({ type: 'sine', f0: midi(88 + n * 3), dur: 0.3, gain: 0.05 }); }
    playUnoCall() { this.tone({ type: 'square', f0: midi(67), dur: 0.15, gain: 0.1 }); this.tone({ type: 'square', f0: midi(72), dur: 0.3, gain: 0.1, at: 0.15 }); }
    playClick() { this.tone({ type: 'square', f0: 900, f1: 600, dur: 0.04, gain: 0.05 }); }
    playTick() { this.tone({ type: 'sine', f0: 1500, dur: 0.03, gain: 0.05 }); }
    playCoin() { this.tone({ type: 'square', f0: midi(83), dur: 0.08, gain: 0.08 }); this.tone({ type: 'square', f0: midi(88), dur: 0.35, gain: 0.08, at: 0.08 }); }
  }

  YC.VintageAudioSynth = VintageAudioSynth;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
