import { useEffect, useState } from "react";
import { getClient, hasCloud } from "./db.js";

// Manager mode: only devices that entered the PIN can change anything. Everyone else with the link can only look.
// The database itself refuses changes without a valid session, so hiding buttons is not the only protection.
const TOKEN_KEY = "salon-turn-manager-token";

let token = (() => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } })();
let state = { isManager: !hasCloud || Boolean(token), status: "ready" }; // optimistic until checked
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(state));

export const getToken = () => token;

function setToken(t) {
  token = t;
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  state = { ...state, isManager: !hasCloud || Boolean(t) };
  emit();
}

let checked = false;
async function check() {
  if (checked || !hasCloud) return;
  checked = true;
  try {
    const sb = await getClient();
    const [{ data: status }, valid] = await Promise.all([
      sb.rpc("manager_status"),
      token ? sb.rpc("manager_check", { p_token: token }).then((r) => r.data) : Promise.resolve(false),
    ]);
    state = { ...state, status: status || "ready" };
    if (token && valid === false) setToken(null);
    else emit();
  } catch {
    /* offline: keep the saved state */
  }
}

// Called when the database refuses a change (e.g. PIN changed on another device)
export function lostManager() {
  if (token) setToken(null);
}

export function useManager() {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    check();
    return () => listeners.delete(setS);
  }, []);
  return s;
}

function cleanError(e) {
  return (e?.message || "Something went wrong").replace(/^.*?:\s*/, "");
}

export async function login(pin) {
  const sb = await getClient();
  const { data, error } = await sb.rpc("manager_login", { p_pin: pin });
  if (error) throw new Error(cleanError(error));
  setToken(data);
}

export async function setupPin(code, pin) {
  const sb = await getClient();
  const { data, error } = await sb.rpc("manager_setup", { p_code: code, p_pin: pin });
  if (error) throw new Error(cleanError(error));
  state = { ...state, status: "ready" };
  setToken(data);
}

export async function logout() {
  const t = token;
  setToken(null);
  if (!t) return;
  try {
    const sb = await getClient();
    await sb.rpc("manager_logout", { p_token: t });
  } catch { /* already signed out locally */ }
}
