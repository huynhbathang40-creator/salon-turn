import { useEffect, useState } from "react";
import {
  Gem, Calendar, CheckCircle2, AlertTriangle, Plus, Pencil, Trash2, X, Crown, Star,
  UserRound, History, RotateCcw, Sun, Power, Archive, Cloud, Smartphone, Loader2, GripVertical, Camera, Lock, PhoneCall,
} from "lucide-react";
import { createStore, newId } from "./store.js";
import SortableList from "./SortableList.jsx";
import HistoryPanel from "./HistoryPanel.jsx";
import RewanowButton from "./RewanowButton.jsx";
import TipsView from "./TipsView.jsx";
import Avatar from "./Avatar.jsx";
import AvatarEditor from "./AvatarEditor.jsx";
import ManagerButton from "./ManagerButton.jsx";
import ThemeButton from "./ThemeButton.jsx";
import { useManager } from "./auth.js";
import TechEditor from "./TechEditor.jsx";
import { useTipRows, saveTechTip, deleteTechTip, tipKey } from "./tips.js";
import { sortByName } from "./staff.js";
import { usePhones, savePhone, phoneKey, telHref, useShowCalls } from "./phones.js";
import { useAvatars, saveAvatar, removeAvatar, nameKey } from "./avatars.js";

// Move `id` to where `overId` is, based on the latest list (safe if another device changed it meanwhile)
function moveTo(list, id, overId) {
  const from = list.indexOf(id);
  const to = list.indexOf(overId);
  if (from < 0 || to < 0 || from === to) return list;
  const result = [...list];
  result.splice(from, 1);
  result.splice(to, 0, id);
  return result;
}

const formatTime = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const formatDate = (t) => new Date(t).toLocaleDateString();

const callBtn = "bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-xl transition shadow-sm active:scale-95";

export default function App() {
  const { isManager: canEdit } = useManager(); // false = view only (no PIN on this device)
  const [store, setStore] = useState(null);
  const [data, setBoard] = useState(null);
  const [archive, setArchive] = useState([]);
  const [syncError, setSyncError] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [confirmNewDay, setConfirmNewDay] = useState(false);
  const [message, setMessage] = useState("");
  // which screen: turn board or tip directory (kept in the link, e.g. .../#tips)
  const [tab, setTab] = useState(() => (window.location.hash === "#tips" ? "tips" : "turns"));
  useEffect(() => {
    const onHash = () => setTab(window.location.hash === "#tips" ? "tips" : "turns");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  function goTab(key) {
    setTab(key);
    history.replaceState(null, "", key === "tips" ? "#tips" : window.location.pathname + window.location.search);
    window.scrollTo(0, 0);
  }
  const [confirmRemoveId, setConfirmRemoveId] = useState(null); // step 1 of removing a turn
  const [lastRemoved, setLastRemoved] = useState(null); // for the Undo button
  const [avatarFor, setAvatarFor] = useState(null); // tech name whose picture is being changed
  const [techEditor, setTechEditor] = useState(null); // { tech } to edit, or { initialName } to add
  const { rows: tipRows } = useTipRows();
  const avatars = useAvatars();
  const phones = usePhones(); // only filled on manager devices
  const [showCalls] = useShowCalls(); // per device: on for iPhone, off for the salon iPad unless switched on
  // 📞 button next to a name (shows only when a number is saved)
  const callLink = (tech, size = 30) => {
    const ph = phones[phoneKey(tech.name)];
    if (!ph || !canEdit || !showCalls) return null;
    return (
      <a
        href={telHref(ph)}
        onPointerDown={(e) => e.stopPropagation()}
        className="shrink-0 rounded-full bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center active:scale-90"
        style={{ width: size, height: size }}
        aria-label={`Call ${tech.name}`}
      >
        <PhoneCall size={Math.round(size * 0.48)} />
      </a>
    );
  };
  const tipByKey = new Map((tipRows || []).map((r) => [r.name_key || tipKey(r.name), r]));

  useEffect(() => {
    let stop = () => {};
    createStore().then((s) => {
      setStore(s);
      stop = s.subscribe((board, arch, err) => {
        setBoard(board);
        setArchive(arch);
        setSyncError(Boolean(err));
      });
    });
    return () => stop();
  }, []);

  const setData = (updater) => (canEdit ? store.update(updater) : undefined);

  function notify(text) {
    setMessage(text);
    window.clearTimeout(notify.t);
    notify.t = window.setTimeout(() => setMessage(""), 2800);
  }

  const getTechnician = (id) => data.technicians.find((t) => t.id === id);

  function addTechnician(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return notify("Please enter a technician name.");
    if (data.technicians.some((t) => t.name.toLowerCase() === name.toLowerCase())) return notify("This technician already exists.");
    setTechEditor({ initialName: name });
    setNewName("");
  }

  // Save from the technician form: tip info first (the database checks it), then the shared staff list
  async function saveTech({ oldName, name, zelle, zelleQr, venmo, venmoQr, phone, phoneChanged }) {
    if (phoneChanged) await savePhone({ oldName, name, phone });
    const hasTipInfo = Boolean(zelle || venmo || zelleQr || venmoQr);
    const savedTip = tipByKey.get(tipKey(oldName || name));
    if (hasTipInfo || savedTip) {
      await saveTechTip({ oldName, name, zelle, zelleQr, venmo, venmoQr });
    } else if (oldName && oldName !== name && avatars[nameKey(oldName)]) {
      // no tip info yet: still keep the picture with the person when renamed
      await saveAvatar(name, avatars[nameKey(oldName)]);
      await removeAvatar(oldName);
    }
    if (!oldName) {
      const id = "tech-" + newId();
      setData((p) => (p.technicians.some((t) => tipKey(t.name) === tipKey(name)) ? p : { ...p, technicians: [...p.technicians, { id, name }] }));
      notify(`${name} added to Turns and Tips.`);
    } else {
      if (oldName !== name) setData((p) => ({ ...p, technicians: p.technicians.map((t) => (t.name === oldName ? { ...t, name } : t)) }));
      notify(`${name} saved.`);
    }
  }

  async function deleteTech(tech) {
    await deleteTechTip(tech.name);
    setData((p) => ({
      ...p,
      technicians: p.technicians.filter((t) => t.id !== tech.id),
      standby: p.standby.filter((x) => x !== tech.id),
      turnPosition: p.turnPosition.filter((x) => x !== tech.id),
      starredIds: p.starredIds.filter((x) => x !== tech.id),
    }));
    notify(`${tech.name} removed.`);
  }

  function saveTechnicianName(id) {
    const name = editingName.trim();
    if (!name) return notify("Name cannot be empty.");
    setData((p) => ({ ...p, technicians: p.technicians.map((t) => (t.id === id ? { ...t, name } : t)) }));
    setEditingId(null);
    setEditingName("");
    notify("Technician name updated.");
  }

  function deleteTechnician(id) {
    const tech = getTechnician(id);
    if (!tech || !window.confirm(`Remove ${tech.name}?`)) return;
    setData((p) => ({
      ...p,
      technicians: p.technicians.filter((t) => t.id !== id),
      standby: p.standby.filter((x) => x !== id),
      turnPosition: p.turnPosition.filter((x) => x !== id),
      starredIds: p.starredIds.filter((x) => x !== id),
    }));
    setEditingId(null);
    notify(`${tech.name} removed.`);
  }

  function addToStandby(id) {
    if (data.standby.includes(id)) return notify("Already in Standby.");
    if (data.turnPosition.includes(id)) return notify("Already in the turn order.");
    setData((p) => ({ ...p, standby: [...p.standby, id] }));
    notify("Added to Standby.");
  }

  const removeFromStandby = (id) => setData((p) => ({ ...p, standby: p.standby.filter((x) => x !== id) }));
  const moveStandby = (id, overId) => setData((p) => ({ ...p, standby: moveTo(p.standby, id, overId) }));
  const moveTurn = (id, overId) => setData((p) => ({ ...p, turnPosition: moveTo(p.turnPosition, id, overId) }));
  // Tech went home early: take them off the turn board (their past calls stay in history)
  function removeFromTurn(id) {
    const tech = getTechnician(id);
    const info = {
      id,
      name: tech?.name || "",
      index: data.turnPosition.indexOf(id),
      starred: data.starredIds.includes(id),
      standbyIndex: data.standby.indexOf(id),
    };
    setData((p) => ({
      ...p,
      turnPosition: p.turnPosition.filter((x) => x !== id),
      standby: p.standby.filter((x) => x !== id),
      starredIds: p.starredIds.filter((x) => x !== id),
    }));
    setConfirmRemoveId(null);
    setLastRemoved(info);
    window.clearTimeout(removeFromTurn.t);
    removeFromTurn.t = window.setTimeout(() => setLastRemoved(null), 8000);
  }

  function undoRemove() {
    const r = lastRemoved;
    if (!r) return;
    const insertAt = (list, i) => {
      if (i < 0 || list.includes(r.id)) return list;
      const next = [...list];
      next.splice(Math.min(i, next.length), 0, r.id);
      return next;
    };
    setData((p) => ({
      ...p,
      turnPosition: insertAt(p.turnPosition, r.index),
      standby: insertAt(p.standby, r.standbyIndex),
      starredIds: r.starred && !p.starredIds.includes(r.id) ? [...p.starredIds, r.id] : p.starredIds,
    }));
    setLastRemoved(null);
    notify(`${r.name} is back in the turn list.`);
  }

  const toggleStar = (id) =>
    setData((p) => ({
      ...p,
      starredIds: p.starredIds.includes(id) ? p.starredIds.filter((x) => x !== id) : [...p.starredIds, id],
    }));

  function callTechnician(id, fromStandby = false) {
    const tech = getTechnician(id);
    if (!tech) return notify("Technician not found.");
    setData((p) => {
      const entry = {
        id: newId(),
        techId: id,
        techName: tech.name,
        turnNo: p.history.length + 1,
        timestamp: new Date().toISOString(),
        beforePosition: [...p.turnPosition],
      };
      return {
        ...p,
        turnPosition: [...p.turnPosition.filter((x) => x !== id), id],
        history: [...p.history, entry],
        standby: fromStandby ? p.standby.filter((x) => x !== id) : p.standby,
      };
    });
    notify(fromStandby ? `${tech.name} called from Standby.` : `${tech.name} called.`);
  }

  // Under-$30 customer: write it in today's history so the customer count is right, but keep everyone's turn
  function logSmall(id) {
    const tech = getTechnician(id);
    if (!tech) return notify("Technician not found.");
    setData((p) => ({
      ...p,
      history: [
        ...p.history,
        { id: newId(), techId: id, techName: tech.name, turnNo: p.history.length + 1, timestamp: new Date().toISOString(), kind: "small" },
      ],
    }));
    notify(`+1 for ${tech.name} (under $30). Turn order unchanged.`);
  }

  // CALL tapped late: fix the time; the first recorded time is kept for reference
  function editTime(entryId, iso) {
    setData((p) => ({
      ...p,
      history: p.history.map((h) =>
        h.id === entryId ? { ...h, timestamp: iso, originalTimestamp: h.originalTimestamp || h.timestamp, edited: true } : h
      ),
    }));
    notify("Time updated.");
  }

  function undoLastCall() {
    if (data.history.length === 0) return notify("There is no call to undo.");
    const lastName = data.history[data.history.length - 1].techName;
    setData((p) => {
      const last = p.history[p.history.length - 1];
      if (!last) return p;
      return {
        ...p,
        history: p.history.slice(0, -1),
        turnPosition: last.kind !== "small" && Array.isArray(last.beforePosition)
          ? last.beforePosition.filter((id) => p.technicians.some((t) => t.id === id))
          : p.turnPosition,
      };
    });
    const wasSmall = data.history[data.history.length - 1].kind === "small";
    notify(wasSmall ? `Last +1 for ${lastName} undone.` : `Last call for ${lastName} undone.`);
  }

  function startNewDay() {
    store.newDay();
    setConfirmNewDay(false);
    notify("New day started.");
  }

  if (!data)
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center p-6 text-brand-charcoal">
        <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl border border-brand-borderGold shadow-sm">
          <Loader2 className="animate-spin text-brand-gold" size={20} />
          <span className="font-serif font-medium text-base tracking-wide">Loading...</span>
        </div>
      </div>
    );

  const isCloud = store.mode === "cloud";
  const sortedTechs = sortByName(data.technicians); // A–Z, owners last
  const smallCount = {}; // today's under-$30 customers per tech (shown as +N)
  for (const h of data.history) if (h.kind === "small") smallCount[h.techId] = (smallCount[h.techId] || 0) + 1;
  const plusBadge = (tech) =>
    smallCount[tech.id] ? (
      <span className="shrink-0 text-[11px] font-bold px-1.5 py-px rounded-md bg-sky-100 text-sky-800" title="Under-$30 customers today">
        +{smallCount[tech.id]}
      </span>
    ) : null;
  const callPair = (tech, fromStandby = false) => (
    <div className="flex shrink-0 rounded-xl overflow-hidden shadow-sm">
      <button
        onClick={() => callTechnician(tech.id, fromStandby)}
        className="bg-emerald-600 active:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider px-3 sm:px-3.5 py-2.5"
      >
        CALL
      </button>
      <button
        onClick={() => logSmall(tech.id)}
        className="bg-sky-50 active:bg-sky-100 text-sky-800 border-l-2 border-white font-extrabold text-xs px-2.5 py-2.5"
        aria-label={`+1 customer under $30 for ${tech.name}`}
      >
        +1
      </button>
    </div>
  );
  const isWorking = (id) => data.standby.includes(id) || data.turnPosition.includes(id); // already in Standby or Turn order
  const activeStandby = data.standby.map(getTechnician).filter(Boolean);
  const activeTurn = data.turnPosition.map(getTechnician).filter(Boolean);
  const starredInTurn = activeTurn.filter((t) => data.starredIds.includes(t.id));

  return (
    <div className="min-h-screen bg-brand-cream text-brand-charcoal flex flex-col justify-between">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-brand-borderLight shadow-sm pt-safe">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden sm:flex w-10 h-10 shrink-0 rounded-xl bg-brand-lightGold border border-brand-borderGold items-center justify-center text-brand-gold shadow-sm">
              <Gem size={20} />
            </div>
            <div>
              <h1 className="font-serif font-bold text-lg leading-tight sm:text-2xl text-brand-charcoal tracking-tight">Nail Salon Call Manager</h1>
              <p className="text-[11px] uppercase tracking-widest hidden min-[400px]:block text-brand-gold font-semibold">Turn Tracking & Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-warmIvory border border-brand-borderLight text-xs text-brand-softSlate">
              <Calendar size={14} className="text-brand-gold" />
              <span>Business Date: <strong className="text-brand-charcoal font-semibold">{data.businessDate}</strong></span>
            </div>
            <ThemeButton onMessage={notify} />
            <ManagerButton onMessage={notify} />
            <RewanowButton />
            <div
              className={`w-2.5 h-2.5 shrink-0 rounded-full ${syncError ? "bg-rose-500" : isCloud ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`}
              title={syncError ? "Connection issue" : isCloud ? "Real-time sync active" : "Saved on this device only"}
            />
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-2.5">
          <div className="flex bg-brand-warmIvory border border-brand-borderLight rounded-xl p-1 max-w-xs">
            {[["turns", "Turns"], ["tips", "Tips"]].map(([key, label]) => (
              <button
                key={key}
                onClick={() => goTab(key)}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${tab === key ? "bg-white text-brand-charcoal shadow-sm" : "text-brand-softSlate"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {tab === "tips" ? (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full flex-grow">
          <TipsView
            technicians={sortByName(data.technicians)}
            canEdit={canEdit}
            onEditTech={(name) => canEdit && setTechEditor({ tech: data.technicians.find((t) => t.name === name) || null, initialName: name })}
          />
        </main>
      ) : (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full flex-grow space-y-6 sm:space-y-8">
        {!canEdit && (
          <div className="p-3.5 rounded-2xl bg-brand-charcoal text-white text-sm flex items-center gap-2.5">
            <Lock size={16} className="text-brand-gold shrink-0" />
            <span>View only. The board updates live, but changes need the manager PIN.</span>
          </div>
        )}

        {/* HERO & TOAST */}
        <div className="relative rounded-3xl p-6 sm:p-8 border border-brand-borderGold/60 shadow-sm overflow-hidden hero-dots">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-brand-lightGold text-brand-gold text-xs font-semibold uppercase tracking-wider mb-2 border border-brand-borderGold/50">
                High-End Salon System
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-brand-charcoal">Real-Time Turn Dispatch</h2>
              <p className="text-sm text-brand-softSlate mt-1 max-w-xl">
                {isCloud
                  ? "Synchronized live queue management for salon floor managers and technicians across all devices."
                  : "Running on this device only. Set up Supabase in src/config.js to sync across devices."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-4 py-2.5 rounded-2xl bg-brand-warmIvory border border-brand-borderLight text-center min-w-[120px]">
                <span className="block text-[10px] uppercase tracking-wider text-brand-softSlate font-medium">In Queue</span>
                <span className="font-serif text-2xl font-bold text-brand-gold">{data.turnPosition.length}</span>
              </div>
              <div className="px-4 py-2.5 rounded-2xl bg-brand-warmIvory border border-brand-borderLight text-center min-w-[120px]">
                <span className="block text-[10px] uppercase tracking-wider text-brand-softSlate font-medium">Customers Today</span>
                <span className="font-serif text-2xl font-bold text-brand-charcoal">{data.history.length}</span>
              </div>
            </div>
          </div>

          {syncError && (
            <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-xl flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-600 shrink-0" />
              <span>Connection issue detected. Changes will sync once back online.</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-start">
          <div className="space-y-6 sm:space-y-8">
            {/* 1. NAIL TECHS */}
            <section className="bg-white rounded-3xl p-5 sm:p-6 border border-brand-borderLight shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-brand-borderLight">
                <div>
                  <h2 className="font-serif text-xl font-bold text-brand-charcoal flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-brand-gold" /> Nail Techs
                  </h2>
                  <p className="text-xs text-brand-softSlate mt-0.5">Active technician directory</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-brand-warmIvory border border-brand-borderLight text-xs font-semibold">
                  {data.technicians.length} Total
                </span>
              </div>

              {canEdit ? (
              <form onSubmit={addTechnician} className="flex gap-2 my-5">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New technician name..."
                  className="flex-1 min-w-0 bg-brand-warmIvory border border-brand-borderLight rounded-2xl px-4 py-2.5 text-base sm:text-sm focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition placeholder:text-slate-400"
                />
                <button type="submit" className="bg-brand-gold hover:bg-brand-goldHover text-white font-semibold text-xs uppercase tracking-wider px-5 py-2.5 rounded-2xl transition shadow-sm active:scale-95 flex items-center gap-1.5">
                  <Plus size={14} /> Add
                </button>
              </form>
              ) : (
                <div className="h-4" />
              )}

              {data.technicians.length === 0 ? (
                <div className="p-8 text-center bg-brand-warmIvory rounded-2xl border border-dashed border-brand-borderLight text-brand-softSlate text-sm">
                  No technicians registered yet.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {sortedTechs.map((tech) => (
                    <div key={tech.id} className="p-3.5 bg-brand-warmIvory/60 border border-brand-borderLight rounded-2xl flex flex-wrap items-center justify-between gap-3">
                      {editingId === tech.id ? (
                        <div className="flex items-center gap-2 w-full">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="flex-1 min-w-0 bg-white border border-brand-gold rounded-xl px-3 py-1.5 text-base sm:text-sm font-semibold outline-none"
                          />
                          <button onClick={() => saveTechnicianName(tech.id)} className="px-3 py-2 bg-brand-gold text-white text-xs font-bold rounded-xl shadow-sm">Save</button>
                          <button onClick={() => setEditingId(null)} className="px-3 py-2 bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl">Cancel</button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => canEdit && setAvatarFor(tech.name)}
                            disabled={!canEdit}
                            className="flex items-center gap-2.5 min-w-0 text-left"
                            aria-label={canEdit ? `Change ${tech.name}'s picture` : tech.name}
                          >
                            <span className="relative">
                              <Avatar name={tech.name} size={40} />
                              <span className={`absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-brand-charcoal text-white items-center justify-center border-2 border-white ${canEdit ? "flex" : "hidden"}`}>
                                <Camera size={9} />
                              </span>
                            </span>
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5 font-bold text-brand-charcoal text-sm"><span className="truncate">{tech.name}</span>{plusBadge(tech)}</span>
                              {tipRows && (() => {
                                const tip = tipByKey.get(tipKey(tech.name));
                                if (!tip) return canEdit ? <span className="text-[10px] font-bold text-amber-700">No Zelle / Venmo</span> : null;
                                return (
                                  <span className="flex gap-1 mt-0.5">
                                    {tip.zelle && <span className="text-[9px] font-bold px-1.5 py-px rounded bg-[#f3e8ff] text-[#7414ca]">ZELLE</span>}
                                    {tip.venmo && <span className="text-[9px] font-bold px-1.5 py-px rounded bg-[#e6f4ff] text-[#008CFF]">VENMO</span>}
                                    {!tip.zelle && !tip.venmo && <span className="text-[9px] font-bold px-1.5 py-px rounded bg-slate-100 text-slate-600">QR</span>}
                                  </span>
                                );
                              })()}
                            </span>
                          </button>
                          {canEdit && <div className="flex items-center gap-2">
                            {callPair(tech)}
                            <button
                              onClick={() => setTechEditor({ tech })}
                              className="px-2.5 py-2 bg-white border border-brand-borderLight text-brand-softSlate rounded-xl"
                              aria-label={`Edit ${tech.name}`}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setTechEditor({ tech })}
                              className="px-2.5 py-2 bg-white border border-brand-borderLight text-rose-600 rounded-xl"
                              aria-label="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>

          {/* 2. LIVE TURN POSITION (Standby on top = ready to be called first) */}
          <div className="space-y-8 order-first lg:order-none">
            <section className="bg-white rounded-3xl p-5 sm:p-6 border-2 border-brand-borderGold/70 shadow-md relative">
              <div className="flex items-center justify-between pb-4 border-b border-brand-borderLight">
                <div>
                  <h2 className="font-serif text-xl font-bold text-brand-charcoal flex items-center gap-2">
                    <Crown size={17} className="text-brand-gold" /> Live Turn Position
                  </h2>
                  <p className="text-xs text-brand-softSlate mt-0.5">{canEdit ? "Hold a name, then drag to move it" : "Live view"}</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-brand-lightGold border border-brand-borderGold text-xs font-bold text-brand-gold">
                  {data.standby.length + data.turnPosition.length} Active
                </span>
              </div>

              {starredInTurn.length > 0 && (
                <div className="priority-banner mt-5 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-amber-500/10 border-2 border-brand-gold text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Star size={14} className="text-brand-gold fill-brand-gold animate-bounce" />
                    <span className="font-serif font-bold text-brand-gold text-xs uppercase tracking-widest">Priority Technicians</span>
                    <Star size={14} className="text-brand-gold fill-brand-gold animate-bounce" />
                  </div>
                  <div className="font-serif text-2xl font-bold text-brand-charcoal tracking-wide">
                    {starredInTurn.map((t) => t.name).join(", ")}
                  </div>
                </div>
              )}

              {/* READY / STANDBY */}
              <div className="mt-5 rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-3">
                <div className="flex items-center justify-between px-1 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Ready · Standby
                  </span>
                  <span className="text-xs font-semibold text-emerald-800">{activeStandby.length} ready</span>
                </div>

                {activeStandby.length === 0 ? (
                  <p className="text-xs text-emerald-900/60 text-center py-3">No one on standby.{canEdit ? " Tap a name below to add." : ""}</p>
                ) : (
                  <SortableList
                    ids={activeStandby.map((t) => t.id)}
                    onReorder={moveStandby}
                    disabled={!canEdit}
                    className="flex flex-col gap-2"
                  >
                    {(id, index) => {
                      const tech = getTechnician(id);
                      return (
                        <div className="p-3 bg-white border border-emerald-200 rounded-xl flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
                          <div className="flex items-center gap-2.5 min-w-[150px] flex-1">
                            <GripVertical size={16} className="text-slate-300 shrink-0 hidden sm:block" />
                            <span className="w-7 h-7 shrink-0 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                              S{index + 1}
                            </span>
                            <Avatar name={tech.name} size={32} ring="border-emerald-200" />
                            <span className="font-bold text-brand-charcoal text-base truncate">{tech.name}</span>
                            {plusBadge(tech)}
                            {callLink(tech)}
                          </div>
                          {canEdit && <div className="flex items-center gap-1 ml-auto">
                            {callPair(tech, true)}
                            <button onClick={() => removeFromStandby(tech.id)} className="p-2 text-rose-600 rounded-lg" aria-label="Remove from standby">
                              <X size={16} />
                            </button>
                          </div>}
                        </div>
                      );
                    }}
                  </SortableList>
                )}

                {canEdit && sortedTechs.length > 0 && (
                  <div className="pt-3 mt-2 border-t border-emerald-200/70">
                    <div className="flex flex-wrap gap-1.5">
                      {sortedTechs.map((tech) => {
                        const working = isWorking(tech.id);
                        return (
                          <button
                            key={tech.id}
                            onClick={() => !working && addToStandby(tech.id)}
                            disabled={working}
                            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                              working
                                ? "bg-slate-100 border-slate-200 text-slate-400 line-through decoration-slate-300 cursor-not-allowed"
                                : "bg-white border-emerald-200 text-emerald-900 active:scale-95"
                            }`}
                            aria-label={working ? `${tech.name} is already working` : `Add ${tech.name} to standby`}
                          >
                            {working ? tech.name : `+ ${tech.name}`}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-emerald-900/60 mt-2">Grey = already working today (in Standby or Turn order).</p>
                  </div>
                )}
              </div>

              {/* TURN ORDER */}
              <div className="flex items-center justify-between px-1 pt-5 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-softSlate">Turn order</span>
                <span className="text-xs font-semibold text-brand-softSlate">{activeTurn.length} in queue</span>
              </div>

              {activeTurn.length === 0 ? (
                <div className="p-8 text-center bg-brand-warmIvory rounded-2xl border border-dashed border-brand-borderLight">
                  <UserRound size={30} className="text-brand-gold/40 mx-auto mb-2" />
                  <p className="font-serif text-base font-semibold text-brand-charcoal">Queue is Empty</p>
                  {canEdit && <p className="text-xs text-brand-softSlate mt-1">Press CALL to dispatch to queue.</p>}
                </div>
              ) : (
                <SortableList
                  ids={activeTurn.map((t) => t.id)}
                  onReorder={moveTurn}
                  disabled={!canEdit}
                  className="flex flex-col gap-2.5 w-full"
                >
                  {(id, index) => {
                    const tech = getTechnician(id);
                    const isStarred = data.starredIds.includes(tech.id);
                    if (confirmRemoveId === id)
                      return (
                        <div className="w-full p-3 sm:p-4 rounded-2xl border-2 border-rose-300 bg-rose-50 space-y-2.5">
                          <p className="text-sm text-rose-900">
                            Remove <strong>{tech.name}</strong> from the turn list?
                            <span className="block text-xs text-rose-800/70 mt-0.5">Past calls stay in today's history.</span>
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => removeFromTurn(id)}
                              className="flex-1 py-2.5 bg-rose-600 text-white font-bold text-sm rounded-xl shadow-sm active:scale-95"
                            >
                              Yes, remove {tech.name}
                            </button>
                            <button
                              onClick={() => setConfirmRemoveId(null)}
                              className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold text-sm rounded-xl"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      );
                    return (
                      <div
                        className={`w-full p-3 sm:p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-x-2 gap-y-2.5 ${
                          isStarred
                            ? "bg-amber-50 border-brand-gold ring-1 ring-brand-gold/30"
                            : index === 0
                            ? "bg-brand-lightGold border-brand-borderGold"
                            : "bg-brand-warmIvory border-brand-borderLight"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-[118px] flex-1">
                          <GripVertical size={16} className="text-slate-300 shrink-0 hidden sm:block" />
                          <div
                            className={`hidden sm:flex w-9 h-9 shrink-0 rounded-xl items-center justify-center font-serif font-bold text-sm ${
                              index === 0 ? "bg-brand-gold text-white shadow-sm" : "bg-white text-brand-charcoal border border-brand-borderLight"
                            }`}
                          >
                            #{index + 1}
                          </div>
                          <span className="relative shrink-0">
                            <Avatar name={tech.name} size={40} />
                            {/* position number on the picture (phones) */}
                            <span
                              className={`sm:hidden absolute -top-1 -left-1 min-w-[20px] h-5 px-1 rounded-full text-[11px] font-bold flex items-center justify-center border-2 border-white ${
                                index === 0 ? "bg-brand-gold text-white" : "bg-brand-charcoal text-white"
                              }`}
                            >
                              {index + 1}
                            </span>
                          </span>
                          <div className="min-w-0 overflow-hidden">
                            <div className="font-bold text-brand-charcoal text-base flex items-center gap-1.5">
                              <span className="truncate">{tech.name}</span>
                              {isStarred && <span className="text-brand-gold font-black">★</span>}
                              {plusBadge(tech)}
                              {callLink(tech, 28)}
                            </div>
                            {index === 0 && (
                              <span className="inline-block whitespace-nowrap text-[10px] uppercase tracking-wider font-bold bg-brand-gold text-white px-2 py-0.5 rounded-full">Next Up</span>
                            )}
                          </div>
                        </div>

                        {canEdit && <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                          <button
                            onClick={() => toggleStar(tech.id)}
                            className={`w-9 h-9 rounded-xl text-base font-bold flex items-center justify-center ${
                              isStarred ? "bg-brand-gold text-white shadow-sm" : "bg-white border border-brand-borderLight text-brand-softSlate"
                            }`}
                            aria-label="Priority"
                          >
                            {isStarred ? "★" : "☆"}
                          </button>
                          {callPair(tech)}
                          <button
                            onClick={() => setConfirmRemoveId(id)}
                            className="w-9 h-9 rounded-xl bg-white border border-brand-borderLight text-rose-600 flex items-center justify-center"
                            aria-label={`Remove ${tech.name} from turn`}
                          >
                            <X size={16} />
                          </button>
                        </div>}
                      </div>
                    );
                  }}
                </SortableList>
              )}

              <p className="text-[11px] text-brand-softSlate italic text-center pt-3 mt-4 border-t border-brand-borderLight">
                Priority star (★) alerts the floor manager without changing queue order.
              </p>
            </section>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          <HistoryPanel data={data} archive={archive} onUndoLastCall={undoLastCall} onEditTime={editTime} canEdit={canEdit} />

          <div className="space-y-6 sm:space-y-8">
            {/* 5. NEW DAY */}
            {canEdit && <section className="bg-white rounded-3xl p-5 sm:p-6 border border-brand-borderLight shadow-sm">
              <div className="pb-3 border-b border-brand-borderLight">
                <h2 className="font-serif text-xl font-bold text-brand-charcoal flex items-center gap-2">
                  <Sun size={16} className="text-amber-500" /> Start New Day
                </h2>
                <p className="text-xs text-brand-softSlate mt-0.5">Archive history and clear queues</p>
              </div>
              {!confirmNewDay ? (
                <button
                  onClick={() => setConfirmNewDay(true)}
                  className="w-full mt-5 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition shadow-sm active:scale-95 flex items-center justify-center gap-2"
                >
                  <Power size={13} /> Start New Day
                </button>
              ) : (
                <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
                  <p className="text-xs text-rose-800 font-medium">Archive today's calls and reset turn position queue for tomorrow?</p>
                  <div className="flex gap-2">
                    <button onClick={startNewDay} className="flex-1 py-2.5 bg-rose-600 text-white font-bold text-xs rounded-xl shadow-sm">
                      Confirm Reset
                    </button>
                    <button onClick={() => setConfirmNewDay(false)} className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>}

            {/* ARCHIVE */}
            <section className="bg-white rounded-3xl p-5 sm:p-6 border border-brand-borderLight shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-brand-borderLight">
                <h2 className="font-serif text-lg font-bold text-brand-charcoal flex items-center gap-2">
                  <Archive size={14} className="text-brand-gold" /> Past Archives
                </h2>
                <span className="text-xs font-semibold text-brand-softSlate">{archive.length} Days</span>
              </div>
              <div className="mt-4 space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {archive.length === 0 ? (
                  <p className="text-xs text-brand-softSlate text-center py-4 italic">No archived days stored.</p>
                ) : (
                  archive.map((day) => (
                    <details key={day.id} className="group border border-brand-borderLight rounded-xl bg-brand-warmIvory/60 overflow-hidden text-xs">
                      <summary className="p-3 font-semibold text-brand-charcoal cursor-pointer flex justify-between items-center group-open:bg-brand-lightGold/50">
                        <span>{day.date}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-brand-gold border border-brand-borderGold">{day.history.length} Calls</span>
                      </summary>
                      <div className="p-3 bg-white border-t border-brand-borderLight space-y-1">
                        {day.history.map((h, i) => (
                          <div key={i} className="flex justify-between text-[11px] text-brand-softSlate py-0.5">
                            <span>#{h.turnNo} {h.techName}</span>
                            <span className="font-mono">{formatTime(h.timestamp)}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
      )}

      <footer className="bg-white border-t border-brand-borderLight py-6 mt-12 text-center text-xs text-brand-softSlate pb-safe">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-serif font-bold text-brand-charcoal">Nail Salon Management System</span>
          <span className="flex items-center gap-1.5">
            {isCloud ? <Cloud size={13} className="text-brand-gold" /> : <Smartphone size={13} className="text-brand-gold" />}
            {isCloud ? "Real-time cloud sync active" : "Saved on this device only"}
          </span>
        </div>
      </footer>

      {/* TOAST: fixed at bottom so it shows wherever you scrolled */}
      {techEditor && canEdit && (
        <TechEditor
          tech={techEditor.tech || null}
          initialName={techEditor.initialName || ""}
          technicians={data.technicians}
          onSave={saveTech}
          onDelete={deleteTech}
          onClose={() => setTechEditor(null)}
        />
      )}
      {avatarFor && canEdit && <AvatarEditor name={avatarFor} onClose={() => setAvatarFor(null)} onSaved={notify} />}
      {lastRemoved && (
        <div className="fixed left-4 right-4 bottom-4 sm:left-auto sm:right-6 sm:w-96 z-50 p-3 bg-brand-charcoal text-white text-sm rounded-xl shadow-lg flex items-center justify-between gap-3 border border-rose-400/50 toast-in mb-safe">
          <span>{lastRemoved.name} removed from turn.</span>
          <button onClick={undoRemove} className="px-3 py-1.5 rounded-lg bg-white text-brand-charcoal font-bold text-xs uppercase tracking-wider">
            Undo
          </button>
        </div>
      )}
      {message && !lastRemoved && (
        <div className="fixed left-4 right-4 bottom-4 sm:left-auto sm:right-6 sm:w-96 z-50 p-3.5 bg-brand-charcoal text-white text-sm rounded-xl shadow-lg flex items-center gap-2 border border-brand-gold/40 toast-in mb-safe">
          <CheckCircle2 size={16} className="text-brand-gold shrink-0" />
          {message}
        </div>
      )}
    </div>
  );
}
