import { useEffect, useState } from "react";

// Light / dark per device. "auto" follows the phone's own setting.
const KEY = "salon-turn-theme";
const media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

export function getTheme() {
  try { return localStorage.getItem(KEY) || "light"; } catch { return "light"; }
}

export function applyTheme(choice = getTheme()) {
  const dark = choice === "dark" || (choice === "auto" && media?.matches);
  document.documentElement.classList.toggle("dark", Boolean(dark));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#1c1c22" : "#FFFFFF");
}

const listeners = new Set();
export function setTheme(choice) {
  try { localStorage.setItem(KEY, choice); } catch { /* ignore */ }
  applyTheme(choice);
  listeners.forEach((fn) => fn(choice));
}

media?.addEventListener?.("change", () => getTheme() === "auto" && applyTheme("auto"));

export function useTheme() {
  const [t, setT] = useState(getTheme());
  useEffect(() => {
    listeners.add(setT);
    return () => listeners.delete(setT);
  }, []);
  return [t, setTheme];
}
