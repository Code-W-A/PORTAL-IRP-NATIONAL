/**
 * Original IRP OS boot sting. Not a commercial recording and not an AC/DC riff.
 * Browsers require a user gesture before audio can start.
 */
export async function playJarvisBootSting() {
  const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  if (ctx.state === "suspended") await ctx.resume();

  const master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);

  const now = ctx.currentTime;

  const tone = (freq: number, start: number, dur: number, type: OscillatorType, vol: number, freqEnd?: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + start);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, now + start + dur);
    filter.type = "lowpass";
    filter.frequency.value = 1800;
    gain.gain.setValueAtTime(0.0001, now + start);
    gain.gain.exponentialRampToValueAtTime(vol, now + start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start(now + start);
    osc.stop(now + start + dur + 0.02);
  };

  const noiseBurst = (start: number, dur: number, vol: number) => {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    src.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = 900;
    gain.gain.setValueAtTime(vol, now + start);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(now + start);
  };

  tone(55, 0.0, 0.9, "sawtooth", 0.18, 36);
  noiseBurst(0.02, 0.18, 0.08);
  tone(220, 0.18, 0.22, "triangle", 0.09);
  tone(330, 0.42, 0.18, "triangle", 0.08);
  tone(440, 0.68, 0.2, "sine", 0.1);
  tone(880, 1.05, 0.35, "sine", 0.06, 1760);
  tone(110, 1.35, 1.1, "sawtooth", 0.12, 73);
  tone(659, 2.15, 0.45, "triangle", 0.07);
  tone(523, 2.55, 0.8, "sine", 0.08);

  window.setTimeout(() => {
    void ctx.close();
  }, 4200);
}
