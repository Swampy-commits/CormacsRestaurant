// The coin sound.
//
// Synthesised with WebAudio rather than loaded from a file: no audio asset, no dependency, and
// nothing to download. Two square-wave notes, the way an arcade cabinet pays out.
//
// It only ever fires from a tap, so browser autoplay rules are satisfied by construction.

const STORAGE_KEY = 'cormac.sound';

let context = null;

/** Is the sound on? Defaults to on; the choice is remembered per device. */
export function soundOn() {
  return localStorage.getItem(STORAGE_KEY) !== 'off';
}

/** Flip the sound on or off and return the new state. */
export function toggleSound() {
  const next = !soundOn();
  localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
  return next;
}

/** Ka-ching. Silently does nothing if sound is off or WebAudio is unavailable. */
export function playCoin() {
  if (!soundOn()) return;

  const audio = audioContext();
  if (!audio) return;

  // B5 then a longer E6 - the classic two-note payout.
  blip(audio, 988, audio.currentTime, 0.08);
  blip(audio, 1319, audio.currentTime + 0.08, 0.32);
}

/** A short descending buzz for a refused booking. */
export function playNope() {
  if (!soundOn()) return;

  const audio = audioContext();
  if (!audio) return;

  blip(audio, 220, audio.currentTime, 0.12, 'sawtooth');
  blip(audio, 165, audio.currentTime + 0.12, 0.22, 'sawtooth');
}

function blip(audio, frequency, startAt, duration, type = 'square') {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;

  // Ramp down rather than stopping dead, which would click.
  gain.gain.setValueAtTime(0.12, startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration);
}

function audioContext() {
  if (context) return context;

  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;

  context = new Ctor();
  return context;
}
