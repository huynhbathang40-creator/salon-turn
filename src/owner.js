import { useEffect, useState } from "react";
import { getClient, hasCloud } from "./db.js";
import { getToken, useManager } from "./auth.js";

// Owner mode: the +1 (under $30) features, behind a second password only the owner knows.
// Remembered on this device; needs manager mode too.
const KEY = "salon-turn-owner";
let flag = (() => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } })();
let status = "ready";
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn({ flag, status }));

function setFlag(v) {
  flag = v;
  try { v ? localStorage.setItem(KEY, "1") : localStorage.removeItem(KEY); } catch { /* ignore */ }
  emit();
}

let checked = false;
async function checkStatus() {
  if (checked || !hasCloud) return;
  checked = true;
  try {
    const sb = await getClient();
    const { data } = await sb.rpc("owner_status");
    status = data || "ready";
    emit();
  } catch { /* offline */ }
}

export function useOwner() {
  const { isManager } = useManager();
  const [s, setS] = useState({ flag, status });
  useEffect(() => {
    listeners.add(setS);
    checkStatus();
    return () => listeners.delete(setS);
  }, []);
  // local test mode (no database): owner mode follows the saved switch only
  return { isOwner: hasCloud ? isManager && s.flag : s.flag, status: s.status };
}

const clean = (e) => (e?.message || "Something went wrong").replace(/^.*?:\s*/, "");

export async function ownerUnlock(pin) {
  const sb = await getClient();
  const { error } = await sb.rpc("owner_unlock", { p_token: getToken(), p_pin: pin });
  if (error) throw new Error(clean(error));
  setFlag(true);
}

export async function ownerSetup(code, pin) {
  const sb = await getClient();
  const { error } = await sb.rpc("owner_setup", { p_token: getToken(), p_code: code, p_pin: pin });
  if (error) throw new Error(clean(error));
  status = "ready";
  setFlag(true);
}

export function exitOwner() {
  setFlag(false);
}
