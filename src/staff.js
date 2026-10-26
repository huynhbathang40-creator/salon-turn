import { useEffect, useState } from "react";
import { getClient, hasCloud } from "./db.js";
import { getToken } from "./auth.js";

// Tip staff list (name + Zelle/Venmo), live on every device. QR pictures are downloaded only when opened.
const LIST_KEY = "salon-turn-tips-list-v2";
const FIELDS = "id,name,role,zelle,venmo,sort,has_zelle_qr,has_venmo_qr,updated_at";

let list = (() => { try { return JSON.parse(localStorage.getItem(LIST_KEY) || "null"); } catch { return null; } })();
let loadError = false;
const qrCache = new Map(); // id -> { zelle_qr, venmo_qr, updated_at }
const listeners = new Set();
const emit = () => {
  try { localStorage.setItem(LIST_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  listeners.forEach((fn) => fn({ list, loadError }));
};

const pick = (r) => Object.fromEntries(FIELDS.split(",").map((k) => [k, r[k]]));
const sortList = (l) => [...l].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));

let started = false;
function start() {
  if (started || !hasCloud) return;
  started = true;
  getClient().then(async (sb) => {
    const load = async () => {
      const { data, error } = await sb.from("tip_staff").select(FIELDS).order("sort");
      loadError = Boolean(error);
      if (data) list = data;
      emit();
    };
    await load();
    sb.channel("tip-staff")
      .on("postgres_changes", { event: "*", schema: "public", table: "tip_staff" }, (p) => {
        const cur = list || [];
        if (p.eventType === "DELETE") list = cur.filter((x) => x.id !== p.old.id);
        else {
          qrCache.delete(p.new.id);
          list = sortList([...cur.filter((x) => x.id !== p.new.id), pick(p.new)]);
        }
        emit();
      })
      .subscribe();
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && load());
  });
}

export function useStaff() {
  const [s, setS] = useState({ list, loadError });
  useEffect(() => {
    start();
    listeners.add(setS);
    return () => listeners.delete(setS);
  }, []);
  return s;
}

export const findStaffByName = (name) =>
  (list || []).find((s) => s.name.trim().toLowerCase() === (name || "").trim().toLowerCase());

export async function getQr(id) {
  if (qrCache.has(id)) return qrCache.get(id);
  const sb = await getClient();
  const { data, error } = await sb.from("tip_staff").select("zelle_qr,venmo_qr").eq("id", id).single();
  if (error) throw error;
  qrCache.set(id, data);
  return data;
}

const clean = (e) => (e?.message || "Could not save").replace(/^.*?:\s*/, "");

// QR args: undefined/null = keep the saved picture, "" = remove it
export async function saveStaff({ id, name, role, zelle, venmo, zelleQr, venmoQr }) {
  const sb = await getClient();
  const { data, error } = await sb.rpc("upsert_staff", {
    p_token: getToken(),
    p_id: id || null,
    p_name: name,
    p_role: role || "",
    p_zelle: zelle || "",
    p_zelle_qr: zelleQr ?? null,
    p_venmo: venmo || "",
    p_venmo_qr: venmoQr ?? null,
  });
  if (error) throw new Error(/not_manager/.test(error.message) ? "This device needs the manager PIN." : clean(error));
  qrCache.delete(data);
  // show it right away (the live update will follow)
  const fresh = await sb.from("tip_staff").select(FIELDS).eq("id", data).single();
  if (fresh.data) {
    list = sortList([...(list || []).filter((x) => x.id !== data), fresh.data]);
    emit();
  }
  return data;
}

export async function deleteStaff(id) {
  const sb = await getClient();
  const { error } = await sb.rpc("delete_staff", { p_token: getToken(), p_id: id });
  if (error) throw new Error(clean(error));
  list = (list || []).filter((x) => x.id !== id);
  emit();
}

// QR picture from the phone: keep it sharp but not huge (max 1000px)
export function qrFileToDataUrl(file, max = 1000) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      const g = c.getContext("2d");
      g.fillStyle = "#fff";
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This file is not a picture."));
    };
    img.src = url;
  });
}
