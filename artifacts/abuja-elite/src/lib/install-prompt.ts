import { useSyncExternalStore } from "react";

/* "Add to home screen" support.
   Android/Chrome can show an install button; iPhones cannot, so we show the steps instead. */

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
let version = 0;
const notify = () => { version += 1; listeners.forEach((l) => l()); };

export function captureInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

export function isStandalone(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

export function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua);
  return ios && safari;
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  const event = deferred;
  deferred = null;
  notify();
  await event.prompt();
  const choice = await event.userChoice;
  if (choice.outcome === "accepted") { installed = true; notify(); }
  return choice.outcome;
}

const DISMISS_KEY = "ae-install-dismissed";
const DISMISS_MS = 14 * 24 * 3600 * 1000;

export function dismissInstallCard() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* private mode */ }
  notify();
}

function recentlyDismissed(): boolean {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY));
    return Boolean(t) && Date.now() - t < DISMISS_MS;
  } catch { return false; }
}

export type InstallState = "hidden" | "button" | "ios";

/** What the install card should show right now. */
export function useInstallState(): InstallState {
  useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => version,
    () => version,
  );
  if (installed || isStandalone() || recentlyDismissed()) return "hidden";
  if (deferred) return "button";
  if (isIosSafari()) return "ios";
  return "hidden";
}
