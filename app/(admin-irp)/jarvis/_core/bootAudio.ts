import { playJarvisBootSting } from "./bootSound";

export const JARVIS_BOOT_TRACK_SRC = "/jarvis/boot.mp3";

let bootAudio: HTMLAudioElement | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeBootAudio(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getBootAudioState() {
  return {
    hasElement: Boolean(bootAudio),
    playing: Boolean(bootAudio && !bootAudio.paused),
  };
}

export function stopJarvisBootTrack() {
  if (!bootAudio) return;
  bootAudio.pause();
  bootAudio.currentTime = 0;
  notify();
}

export function toggleJarvisBootTrack() {
  if (!bootAudio) return;
  if (bootAudio.paused) void bootAudio.play();
  else bootAudio.pause();
  notify();
}

export async function hasJarvisBootTrack() {
  try {
    const res = await fetch(JARVIS_BOOT_TRACK_SRC, { method: "HEAD", cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function playJarvisBootAudio() {
  const available = await hasJarvisBootTrack();
  if (!available) {
    stopJarvisBootTrack();
    await playJarvisBootSting();
    return { source: "sting" as const };
  }

  if (!bootAudio) {
    bootAudio = new Audio(JARVIS_BOOT_TRACK_SRC);
    bootAudio.preload = "auto";
    bootAudio.volume = 0.85;
    bootAudio.addEventListener("play", notify);
    bootAudio.addEventListener("pause", notify);
    bootAudio.addEventListener("ended", notify);
  }

  bootAudio.currentTime = 0;
  await bootAudio.play();
  notify();
  return { source: "mp3" as const };
}
