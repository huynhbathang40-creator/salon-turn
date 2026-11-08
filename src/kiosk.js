import { useEffect, useState } from "react";

// Customer mode ("kiosk") for one iPad: only Tips + Pay, nothing else can be touched.
// Saved on this device only. The 6-digit password is kept as a SHA-256 hash, never as plain text.
const ON_KEY = "salon-turn-kiosk";
const PASS_KEY = "salon-turn-kiosk-pass";

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ } };

let on = read(ON_KEY) === "1";
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(on));

async function hash(pin) {
  const bytes = new TextEncoder().encode("salon-turn-kiosk:" + pin);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const hasKioskPassword = () => Boolean(read(PASS_KEY));

export function useKiosk() {
  const [s, setS] = useState(on);
  useEffect(() => {
    listeners.add(setS);
    return () => listeners.delete(setS);
  }, []);
  return s;
}

// turn on, saving a new password (first time or "change password")
export async function startKiosk(newPin) {
  if (newPin) write(PASS_KEY, await hash(newPin));
  if (!read(PASS_KEY)) throw new Error("Set a password first.");
  on = true;
  write(ON_KEY, "1");
  emit();
}

export async function checkKioskPin(pin) {
  return (await hash(pin)) === read(PASS_KEY);
}

export function stopKiosk({ forgetPassword = false } = {}) {
  on = false;
  write(ON_KEY, null);
  if (forgetPassword) write(PASS_KEY, null);
  emit();
}
