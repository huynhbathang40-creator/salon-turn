import { useEffect, useState } from "react";
import { getClient, hasCloud } from "./db.js";
import { getToken } from "./auth.js";

// Technician pictures, shared live between devices. Key = lowercase name, so Turns and Tips match.
export const nameKey = (name) => (name || "").trim().toLowerCase();

const CACHE_KEY = "salon-turn-avatars-v1";
let map = (() => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; }
})();
const listeners = new Set();
const emit = () => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(map)); } catch { /* storage full: keep in memory */ }
  listeners.forEach((fn) => fn(map));
};

let started = false;
function start() {
  if (started || !hasCloud) return;
  started = true;
  getClient().then(async (sb) => {
    const load = async () => {
      const { data } = await sb.from("avatars").select("name_key,image");
      if (data) {
        map = Object.fromEntries(data.map((r) => [r.name_key, r.image]));
        emit();
      }
    };
    await load();
    sb.channel("avatars")
      .on("postgres_changes", { event: "*", schema: "public", table: "avatars" }, (p) => {
        if (p.eventType === "DELETE") delete map[p.old.name_key];
        else map = { ...map, [p.new.name_key]: p.new.image };
        if (p.eventType === "DELETE") map = { ...map };
        emit();
      })
      .subscribe();
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && load());
  });
}

export function useAvatars() {
  const [state, setState] = useState(map);
  useEffect(() => {
    start();
    listeners.add(setState);
    return () => listeners.delete(setState);
  }, []);
  return state;
}

export async function saveAvatar(name, image) {
  const key = nameKey(name);
  map = { ...map, [key]: image };
  emit();
  if (!hasCloud) return;
  const sb = await getClient();
  const { error } = await sb.rpc("set_avatar", { p_token: getToken(), p_key: key, p_image: image });
  if (error) throw error;
}

export async function removeAvatar(name) {
  const key = nameKey(name);
  map = { ...map };
  delete map[key];
  emit();
  if (!hasCloud) return;
  const sb = await getClient();
  const { error } = await sb.rpc("remove_avatar", { p_token: getToken(), p_key: key });
  if (error) throw error;
}

/* ---------- photos: shrink to a small square so it loads fast ---------- */

export function fileToSquare(file, size = 320) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2;
      // faces are usually in the upper part of a portrait photo
      const sy = img.naturalHeight > img.naturalWidth ? (img.naturalHeight - side) * 0.3 : (img.naturalHeight - side) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      canvas.getContext("2d").drawImage(img, sx, sy, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This file is not a picture iPhone can read"));
    };
    img.src = url;
  });
}

/* ---------- built-in icons for techs who prefer no photo ---------- */

const SKIN = ["#F6D3B3", "#E8B48A", "#C68642", "#8D5524"];
const HAIR = ["#2B2118", "#5A3825", "#8C5A2B", "#C9A15B", "#1F1F1F", "#7A2E3A"];
const BG = ["#F7F3EB", "#E8F1FB", "#EAF7EF", "#FBEFF3", "#F1ECFB", "#FFF4E0"];

export const PRESETS = [
  ["f", 0, 0, 3], ["f", 1, 1, 0], ["f", 2, 4, 4], ["f", 3, 4, 2], ["f", 0, 3, 5], ["f", 1, 5, 1],
  ["m", 0, 0, 1], ["m", 1, 4, 0], ["m", 2, 1, 2], ["m", 3, 4, 5], ["m", 1, 2, 3], ["m", 0, 3, 4],
].map(([g, s, h, b], i) => ({ id: `preset:${g}${i}`, g, skin: SKIN[s], hair: HAIR[h], bg: BG[b] }));

function presetSvg({ g, skin, hair, bg }) {
  const female = g === "f";
  const longHair = female ? `<path d="M30 52c0-24 13-36 34-36s34 12 34 36v40H30z" fill="${hair}"/>` : "";
  const top = female
    ? `<path d="M38 50c2-18 13-26 26-26s24 8 26 26c-9-8-20-11-30-10-9 1-16 4-22 10z" fill="${hair}"/>`
    : `<path d="M40 50c0-16 10-25 24-25s24 9 24 25c-5-6-13-9-24-9s-19 3-24 9z" fill="${hair}"/>`;
  const shirt = female ? "#C5A059" : "#4A4A52";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="${bg}"/>${longHair}<path d="M22 128c3-24 20-36 42-36s39 12 42 36z" fill="${shirt}"/><rect x="55" y="74" width="18" height="22" rx="8" fill="${skin}"/><ellipse cx="64" cy="56" rx="23" ry="26" fill="${skin}"/>${top}<circle cx="55.5" cy="58" r="2.6" fill="#2B2118"/><circle cx="72.5" cy="58" r="2.6" fill="#2B2118"/><path d="M57 68c4 3.5 10 3.5 14 0" stroke="#9A5A3C" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
}

const presetCache = new Map();
export function presetUrl(id) {
  if (!presetCache.has(id)) {
    const p = PRESETS.find((x) => x.id === id);
    presetCache.set(id, p ? "data:image/svg+xml;charset=utf-8," + encodeURIComponent(presetSvg(p)) : "");
  }
  return presetCache.get(id);
}

// What to put in <img src>: a preset id, a stored photo, or a web link
export function imageSrc(value) {
  if (!value) return "";
  return value.startsWith("preset:") ? presetUrl(value) : value;
}
