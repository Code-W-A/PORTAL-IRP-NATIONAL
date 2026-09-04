const LOGIN_TRACK_SRC = "/jarvis/boot.mp3";

let loginAudio: HTMLAudioElement | null = null;
let userMuted = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function ensureAudio() {
  if (loginAudio) return loginAudio;
  loginAudio = new Audio(LOGIN_TRACK_SRC);
  loginAudio.preload = "auto";
  loginAudio.loop = true;
  loginAudio.volume = 0.35;
  loginAudio.addEventListener("play", notify);
  loginAudio.addEventListener("pause", notify);
  return loginAudio;
}

export function subscribeLoginAudio(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLoginAudioPlaying() {
  return Boolean(loginAudio && !loginAudio.paused && !loginAudio.muted);
}

export async function startLoginAudio() {
  if (userMuted) return false;
  const audio = ensureAudio();
  audio.muted = false;
  try {
    await audio.play();
    notify();
    return true;
  } catch {
    return false;
  }
}

export function setLoginAudioMuted(muted: boolean) {
  userMuted = muted;
  const audio = ensureAudio();
  audio.muted = muted;
  if (muted) {
    audio.pause();
  } else {
    void audio.play().catch(() => {});
  }
  notify();
}

export function toggleLoginAudioMuted() {
  const audio = ensureAudio();
  const shouldMute = !audio.paused && !audio.muted;
  setLoginAudioMuted(shouldMute);
}

export function stopLoginAudio() {
  userMuted = false;
  if (!loginAudio) return;
  loginAudio.pause();
  loginAudio.currentTime = 0;
  loginAudio.muted = false;
  notify();
}
