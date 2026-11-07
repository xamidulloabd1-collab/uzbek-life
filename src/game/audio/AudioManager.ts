/**
 * All sound is synthesised with WebAudio, so there are no audio files to
 * license or load. Replace with recorded, licensed samples later if desired.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private engine!: { o1: OscillatorNode; o2: OscillatorNode; filter: BiquadFilterNode; gain: GainNode };
  private ambience!: GainNode;
  private rain!: GainNode;
  private traffic!: { osc: OscillatorNode; gain: GainNode };
  private noise!: AudioBuffer;
  private siren!: GainNode;
  private volume = 0.7;

  /** must be called from a user gesture (Play button / first touch) */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      data[i] = w * 0.5 + last * 3;
    }

    const loopNoise = (type: BiquadFilterType, freq: number, q: number) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(this.master);
      src.start();
      return g;
    };
    this.ambience = loopNoise('bandpass', 420, 0.4);
    this.rain = loopNoise('highpass', 2400, 0.3);

    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    const o2 = ctx.createOscillator();
    o2.type = 'square';
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    filter.Q.value = 2;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const g2 = ctx.createGain();
    g2.gain.value = 0.5;
    o1.connect(filter);
    o2.connect(g2).connect(filter);
    filter.connect(gain).connect(this.master);
    o1.start();
    o2.start();
    this.engine = { o1, o2, filter, gain };

    const tOsc = ctx.createOscillator();
    tOsc.type = 'triangle';
    tOsc.frequency.value = 55;
    const tGain = ctx.createGain();
    tGain.gain.value = 0;
    const tf = ctx.createBiquadFilter();
    tf.type = 'lowpass';
    tf.frequency.value = 300;
    tOsc.connect(tf).connect(tGain).connect(this.master);
    tOsc.start();
    this.traffic = { osc: tOsc, gain: tGain };

    // police siren: sawtooth swept by a slow LFO
    const so = ctx.createOscillator();
    so.type = 'sawtooth';
    so.frequency.value = 880;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.85;
    const lg = ctx.createGain();
    lg.gain.value = 330;
    lfo.connect(lg).connect(so.frequency);
    const sf = ctx.createBiquadFilter();
    sf.type = 'lowpass';
    sf.frequency.value = 2400;
    this.siren = ctx.createGain();
    this.siren.gain.value = 0;
    so.connect(sf).connect(this.siren).connect(this.master);
    so.start();
    lfo.start();
  }

  setSiren(level: number) {
    if (this.ctx) this.siren.gain.setTargetAtTime(Math.min(1, level) * 0.05, this.ctx.currentTime, 0.25);
  }

  private tone(freq: number, start: number, dur: number, vol: number, type: OscillatorType = 'square') {
    const ctx = this.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t = ctx.currentTime + start;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.setValueAtTime(vol, t + dur - 0.04);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  horn() {
    this.tone(415, 0, 0.45, 0.06);
    this.tone(523, 0, 0.45, 0.05);
  }

  alarm() {
    for (let k = 0; k < 8; k++) this.tone(k % 2 ? 760 : 980, k * 0.22, 0.18, 0.06);
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  suspend(paused: boolean) {
    if (!this.ctx) return;
    if (paused) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  update(p: { inVehicle: boolean; rpm: number; throttle: number; night: number; rain: number; trafficDist: number; rural: boolean }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const f = 18 + (p.rpm / 60) * 1.9;
    this.engine.o1.frequency.setTargetAtTime(f, t, 0.05);
    this.engine.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.engine.filter.frequency.setTargetAtTime(260 + p.throttle * 900 + p.rpm * 0.08, t, 0.08);
    this.engine.gain.gain.setTargetAtTime(p.inVehicle ? 0.05 + p.throttle * 0.07 : 0, t, 0.12);
    const amb = (p.rural ? 0.015 : 0.045) * (1 - p.night * 0.6);
    this.ambience.gain.setTargetAtTime(amb, t, 0.5);
    this.rain.gain.setTargetAtTime(p.rain * 0.09, t, 0.5);
    const tg = p.trafficDist < 40 ? (1 - p.trafficDist / 40) * 0.05 : 0;
    this.traffic.gain.gain.setTargetAtTime(tg, t, 0.2);
    this.traffic.osc.frequency.setTargetAtTime(48 + tg * 300, t, 0.3);
  }

  private burst(freq: number, dur: number, vol: number, type: BiquadFilterType = 'bandpass') {
    const ctx = this.ctx;
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  footstep() {
    this.burst(180 + Math.random() * 120, 0.09, 0.12);
  }

  impact(strength: number) {
    this.burst(120, 0.35, Math.min(0.6, 0.12 + strength * 0.04), 'lowpass');
  }

  ui() {
    const ctx = this.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.14);
  }
}
