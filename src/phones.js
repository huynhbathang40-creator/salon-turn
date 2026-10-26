import { useEffect, useState } from "react";
import { getClient, hasCloud } from "./db.js";
import { getToken, useManager } from "./auth.js";

// Technicians' phone numbers. Private: only loaded on manager devices (after the PIN), never cached for viewers.
export const phoneKey = (name) => (name || "").trim().toLowerCase();

let phones = {};
let loadedFor = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(phones));

async function load() {
  const token = getToken();
  if (!hasCloud) {
    try { phones = JSON.parse(localStorage.getItem("salon-turn-phones-local") || "{}"); } catch { phones = {}; }
    emit();
    return;
  }
  if (!token) {
    phones = {};
    emit();
    return;
  }
  try {
    const sb = await getClient();
    const { data, error } = await sb.rpc("get_tech_phones", { p_token: token });
    if (error) throw error;
    phones = Object.fromEntries((data || []).map((r) => [r.name_key, r.phone]));
    loadedFor = token;
  } catch (e) {
    console.error(e);
  }
  emit();
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && loadedFor && load());
}

export function usePhones() {
  const { isManager } = useManager();
  const [s, setS] = useState(phones);
  useEffect(() => {
    listeners.add(setS);
    if (isManager && (loadedFor !== getToken() || !hasCloud)) load();
    if (!isManager && Object.keys(phones).length) { phones = {}; loadedFor = null; emit(); }
    return () => listeners.delete(setS);
  }, [isManager]);
  return s;
}

export async function savePhone({ oldName, name, phone }) {
  if (!hasCloud) {
    const local = { ...phones };
    delete local[phoneKey(oldName || name)];
    if (phone) local[phoneKey(name)] = phone;
    try { localStorage.setItem("salon-turn-phones-local", JSON.stringify(local)); } catch { /* ignore */ }
    return load();
  }
  const sb = await getClient();
  const { error } = await sb.rpc("set_tech_phone", { p_token: getToken(), p_old_name: oldName || null, p_name: name, p_phone: phone || "" });
  if (error) throw new Error((error.message || "Could not save phone").replace(/^.*?:\s*/, ""));
  await load();
}

// "561-639-3313" / "(561) 639 3313" -> "+15616393313" (US numbers); other formats kept as digits
export function telHref(phone) {
  const d = (phone || "").replace(/[^0-9+]/g, "");
  if (/^\d{10}$/.test(d)) return "tel:+1" + d;
  if (/^1\d{10}$/.test(d)) return "tel:+" + d;
  return "tel:" + d;
}

export function prettyPhone(phone) {
  const d = (phone || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return /^\d{10}$/.test(d) ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : phone;
}

// Zelle info that is a US phone number (to offer "use the Zelle number")
export function phoneFromZelle(zelle) {
  const d = (zelle || "").replace(/\D/g, "");
  return /^1?\d{10}$/.test(d) && !/@/.test(zelle || "") ? d.replace(/^1(?=\d{10}$)/, "") : "";
}

/* ---------- show 📞 buttons on this device? (iPhone: yes by default; own iPad / Mac: switch it on once) ---------- */

const SHOW_KEY = "salon-turn-show-calls";
const isPhoneDevice = () => {
  const ua = navigator.userAgent || "";
  if (/iPhone|Android.+Mobile/i.test(ua)) return true;
  return navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 600;
};
let showCalls = (() => {
  try {
    const v = localStorage.getItem(SHOW_KEY);
    if (v === "on") return true;
    if (v === "off") return false;
  } catch { /* ignore */ }
  return isPhoneDevice();
})();
const showListeners = new Set();

export function useShowCalls() {
  const [s, setS] = useState(showCalls);
  useEffect(() => {
    showListeners.add(setS);
    return () => showListeners.delete(setS);
  }, []);
  return [s, setShowCalls];
}

export function setShowCalls(v) {
  showCalls = v;
  try { localStorage.setItem(SHOW_KEY, v ? "on" : "off"); } catch { /* ignore */ }
  showListeners.forEach((fn) => fn(v));
}
