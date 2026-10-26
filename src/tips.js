import { useEffect, useState } from "react";
import { getClient, hasCloud } from "./db.js";
import { getToken } from "./auth.js";

// Tip info (Zelle / Venmo) for each technician, matched to the turn board by name.
export const tipKey = (name) => (name || "").trim().toLowerCase();

const LIST_KEY = "salon-turn-tips-list-v2";
let rows = (() => { try { return JSON.parse(localStorage.getItem(LIST_KEY) || "null"); } catch { return null; } })();
let loadError = false;
const qrCache = new Map(); // name_key -> { zelle_qr, venmo_qr }
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn({ rows, loadError }));

async function load() {
  try {
    const sb = await getClient();
    const { data, error } = await sb.from("tip_staff").select("id,name,name_key,role,zelle,venmo,sort").order("sort");
    if (error) throw error;
    rows = data;
    loadError = false;
    try { localStorage.setItem(LIST_KEY, JSON.stringify(rows)); } catch { /* ignore */ }
  } catch (e) {
    console.error(e);
    loadError = true;
  }
  emit();
}

let started = false;
function start() {
  if (started || !hasCloud) return;
  started = true;
  load();
  getClient().then((sb) =>
    sb.channel("tip-staff")
      .on("postgres_changes", { event: "*", schema: "public", table: "tip_staff" }, (p) => {
        qrCache.delete(p.old?.name_key);
        qrCache.delete(p.new?.name_key);
        load();
      })
      .subscribe()
  );
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && load());
}

export function useTipRows() {
  const [s, setS] = useState({ rows, loadError });
  useEffect(() => {
    start();
    listeners.add(setS);
    return () => listeners.delete(setS);
  }, []);
  return s;
}

// QR pictures are big, so they are fetched only when a tech is opened
export async function getQr(nameKey) {
  if (qrCache.has(nameKey)) return qrCache.get(nameKey);
  const sb = await getClient();
  const { data, error } = await sb.from("tip_staff").select("zelle_qr,venmo_qr").eq("name_key", nameKey).maybeSingle();
  if (error) throw error;
  const value = data || { zelle_qr: null, venmo_qr: null };
  qrCache.set(nameKey, value);
  return value;
}

function clean(e) {
  return (e?.message || "Could not save").replace(/^.*?:\s*/, "");
}

// zelleQr / venmoQr: undefined = keep, "" = remove, data URL = new picture
export async function saveTechTip({ oldName, name, zelle, zelleQr, venmo, venmoQr }) {
  const sb = await getClient();
  const { error } = await sb.rpc("save_tech_tip", {
    p_token: getToken(),
    p_old_name: oldName || null,
    p_name: name,
    p_zelle: zelle || "",
    p_zelle_qr: zelleQr === undefined ? null : zelleQr,
    p_venmo: venmo || "",
    p_venmo_qr: venmoQr === undefined ? null : venmoQr,
  });
  if (error) throw new Error(clean(error));
  qrCache.delete(tipKey(oldName || name));
  qrCache.delete(tipKey(name));
  await load();
}

export async function deleteTechTip(name) {
  const sb = await getClient();
  const { error } = await sb.rpc("delete_tech_tip", { p_token: getToken(), p_name: name });
  if (error) throw new Error(clean(error));
  qrCache.delete(tipKey(name));
  await load();
}

// Uploaded QR screenshot/photo -> picture small enough to load fast but still sharp enough to scan
export function qrFileToDataUrl(file, max = 1100) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This file is not a picture."));
    };
    img.src = url;
  });
}
