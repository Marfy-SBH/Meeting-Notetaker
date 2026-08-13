// A short two-tone chime synthesized with the Web Audio API — no audio
// asset to ship or fetch, and it works the moment this module loads.
let audioContext: AudioContext | null = null;

function getContext() {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return null;
    audioContext = new Ctor();
  }
  return audioContext;
}

// Browsers suspend new AudioContexts until a user gesture — call this once
// from any early click/keydown handler so the first real chime isn't silent.
export function unlockNotificationSound() {
  getContext()?.resume();
}

export function playNotificationSound() {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();

  const now = ctx.currentTime;
  [{ freq: 880, start: 0 }, { freq: 1175, start: 0.1 }].forEach(({ freq, start }) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(0.15, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.25);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now + start);
    oscillator.stop(now + start + 0.26);
  });
}
