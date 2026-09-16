import { isPlaying } from './speaker';

export interface MeterFrame { level: number; voiced: boolean }
type Listener = (f: MeterFrame) => void;

/** Lightweight voice-activity meter. Everything stays on device. */
class VoiceMeter {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private buf: Float32Array | null = null;
  private raf = 0;
  private listeners = new Set<Listener>();
  private noise = 0.01;
  private calibrating = 0;
  sensitivity = 3; // 1 (strict) .. 5 (sensitive)
  ready = false;
  error: string | null = null;

  // Test hook: ?simvoice makes window.__voice(ms) simulate speaking for ms.
  private simUntil = 0;
  private simLoop = () => {
    const voiced = !isPlaying() && performance.now() < this.simUntil;
    for (const l of this.listeners) l({ level: voiced ? 0.7 : 0.02, voiced });
    this.raf = requestAnimationFrame(this.simLoop);
  };

  async start(): Promise<boolean> {
    if (this.ready) { await this.ctx?.resume(); return true; }
    if (location.search.includes('simvoice')) {
      (window as unknown as { __voice: (ms: number) => void }).__voice = (ms) => { this.simUntil = performance.now() + ms; };
      this.ready = true;
      this.simLoop();
      return true;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
      });
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      src.connect(this.analyser);
      this.buf = new Float32Array(this.analyser.fftSize);
      this.ready = true;
      this.calibrating = 25; // ~400ms of frames
      this.loop();
      return true;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      return false;
    }
  }

  private loop = () => {
    if (!this.analyser || !this.buf) return;
    this.analyser.getFloatTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
    const rms = Math.sqrt(sum / this.buf.length);
    if (this.calibrating > 0) {
      this.noise = this.noise * 0.8 + rms * 0.2;
      this.calibrating--;
    } else if (rms < this.noise * 1.5) {
      this.noise = this.noise * 0.995 + rms * 0.005; // slow drift
    }
    const floor = [0.06, 0.04, 0.025, 0.017, 0.011][Math.max(0, Math.min(4, this.sensitivity - 1))];
    const threshold = Math.max(floor, this.noise * 2.5);
    const voiced = !isPlaying() && rms > threshold;
    const level = Math.min(1, rms / (threshold * 4));
    for (const l of this.listeners) l({ level, voiced });
    this.raf = requestAnimationFrame(this.loop);
  };

  subscribe(l: Listener) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }

  recalibrate() { this.calibrating = 25; }

  stop() {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close();
    this.ctx = null; this.stream = null; this.analyser = null; this.ready = false;
  }

  getStream() { return this.stream; }
}

export const meter = new VoiceMeter();
