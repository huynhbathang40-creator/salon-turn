import { useEffect, useState } from "react";
import {
  Gem, Calendar, CheckCircle2, AlertTriangle, Plus, Pencil, Trash2, X, Crown, Star,
  UserRound, History, RotateCcw, Sun, Power, Archive, Cloud, Smartphone, Loader2, GripVertical,
} from "lucide-react";
import { createStore, newId } from "./store.js";
import SortableList from "./SortableList.jsx";

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
  const [store, setStore] = useState(null);
  const [data, setBoard] = useState(null);
  const [archive, setArchive] = useState([]);
  const [syncError, setSyncError] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [confirmNewDay, setConfirmNewDay] = useState(false);
  const [message, setMessage] = useState("");

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

  const setData = (updater) => store.update(updater);

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
    const id = "tech-" + newId();
    setData((p) => ({ ...p, technicians: [...p.technicians, { id, name }] }));
    setNewName("");
    notify(`${name} added.`);
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
    setData((p) => ({ ...p, standby: [...p.standby, id] }));
    notify("Added to Standby.");
  }

  const removeFromStandby = (id) => setData((p) => ({ ...p, standby: p.standby.filter((x) => x !== id) }));
  const moveStandby = (id, overId) => setData((p) => ({ ...p, standby: moveTo(p.standby, id, overId) }));
  const moveTurn = (id, overId) => setData((p) => ({ ...p, turnPosition: moveTo(p.turnPosition, id, overId) }));
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

  function undoLastCall() {
    if (data.history.length === 0) return notify("There is no call to undo.");
    const lastName = data.history[data.history.length - 1].techName;
    setData((p) => {
      const last = p.history[p.history.length - 1];
      if (!last) return p;
      return {
        ...p,
        history: p.history.slice(0, -1),
        turnPosition: Array.isArray(last.beforePosition)
          ? last.beforePosition.filter((id) => p.technicians.some((t) => t.id === id))
          : p.turnPosition,
      };
    });
    notify(`Last call for ${lastName} undone.`);
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
  const availableForStandby = data.technicians.filter((t) => !data.standby.includes(t.id));
  const activeStandby = data.standby.map(getTechnician).filter(Boolean);
  const activeTurn = data.turnPosition.map(getTechnician).filter(Boolean);
  const starredInTurn = activeTurn.filter((t) => data.starredIds.includes(t.id));

  return (
    <div className="min-h-screen bg-brand-cream text-brand-charcoal flex flex-col justify-between">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-brand-borderLight shadow-sm pt-safe">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-lightGold border border-brand-borderGold flex items-center justify-center text-brand-gold shadow-sm">
              <Gem size={20} />
            </div>
            <div>
              <h1 className="font-serif font-bold text-xl sm:text-2xl text-brand-charcoal tracking-tight">Nail Salon Call Manager</h1>
              <p className="text-[11px] uppercase tracking-widest text-brand-gold font-semibold">Turn Tracking & Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-warmIvory border border-brand-borderLight text-xs text-brand-softSlate">
              <Calendar size={14} className="text-brand-gold" />
              <span>Business Date: <strong className="text-brand-charcoal font-semibold">{data.businessDate}</strong></span>
            </div>
            <div
              className={`w-2.5 h-2.5 rounded-full ${syncError ? "bg-rose-500" : isCloud ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`}
              title={syncError ? "Connection issue" : isCloud ? "Real-time sync active" : "Saved on this device only"}
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full flex-grow space-y-6 sm:space-y-8">
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
                <span className="block text-[10px] uppercase tracking-wider text-brand-softSlate font-medium">Calls Today</span>
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
                    <span className="w-2 h-2 rounded-full bg-brand-gold" /> 1. Nail Techs
                  </h2>
                  <p className="text-xs text-brand-softSlate mt-0.5">Active technician directory</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-brand-warmIvory border border-brand-borderLight text-xs font-semibold">
                  {data.technicians.length} Total
                </span>
              </div>

              <form onSubmit={addTechnician} className="flex gap-2 my-5">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter technician name..."
                  className="flex-1 min-w-0 bg-brand-warmIvory border border-brand-borderLight rounded-2xl px-4 py-2.5 text-base sm:text-sm focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition placeholder:text-slate-400"
                />
                <button type="submit" className="bg-brand-gold hover:bg-brand-goldHover text-white font-semibold text-xs uppercase tracking-wider px-5 py-2.5 rounded-2xl transition shadow-sm active:scale-95 flex items-center gap-1.5">
                  <Plus size={14} /> Add
                </button>
              </form>

              {data.technicians.length === 0 ? (
                <div className="p-8 text-center bg-brand-warmIvory rounded-2xl border border-dashed border-brand-borderLight text-brand-softSlate text-sm">
                  No technicians registered yet.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {data.technicians.map((tech) => (
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
                          <span className="font-bold text-brand-charcoal text-sm">{tech.name}</span>
                          <div className="flex items-center gap-2">
                            <button onClick={() => callTechnician(tech.id)} className={callBtn}>CALL</button>
                            <button
                              onClick={() => { setEditingId(tech.id); setEditingName(tech.name); }}
                              className="px-2.5 py-2 bg-white border border-brand-borderLight text-brand-softSlate rounded-xl"
                              aria-label="Edit name"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => deleteTechnician(tech.id)}
                              className="px-2.5 py-2 bg-white border border-brand-borderLight text-rose-600 rounded-xl"
                              aria-label="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
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
                  <p className="text-xs text-brand-softSlate mt-0.5">Hold a name, then drag to move it</p>
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
                  <p className="text-xs text-emerald-900/60 text-center py-3">No one on standby. Tap a name below to add.</p>
                ) : (
                  <SortableList
                    ids={activeStandby.map((t) => t.id)}
                    onReorder={moveStandby}
                    className="flex flex-col gap-2"
                  >
                    {(id, index) => {
                      const tech = getTechnician(id);
                      return (
                        <div className="p-3 bg-white border border-emerald-200 rounded-xl flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <GripVertical size={16} className="text-slate-300 shrink-0" />
                            <span className="w-7 h-7 shrink-0 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                              S{index + 1}
                            </span>
                            <span className="font-bold text-brand-charcoal text-base truncate">{tech.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => callTechnician(tech.id, true)} className={callBtn}>CALL</button>
                            <button onClick={() => removeFromStandby(tech.id)} className="p-2 text-rose-600 rounded-lg" aria-label="Remove from standby">
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    }}
                  </SortableList>
                )}

                {availableForStandby.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-3 mt-2 border-t border-emerald-200/70">
                    {availableForStandby.map((tech) => (
                      <button
                        key={tech.id}
                        onClick={() => addToStandby(tech.id)}
                        className="px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900"
                      >
                        + {tech.name}
                      </button>
                    ))}
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
                  <p className="text-xs text-brand-softSlate mt-1">Press CALL to dispatch to queue.</p>
                </div>
              ) : (
                <SortableList
                  ids={activeTurn.map((t) => t.id)}
                  onReorder={moveTurn}
                  className="flex flex-col gap-2.5 w-full"
                >
                  {(id, index) => {
                    const tech = getTechnician(id);
                    const isStarred = data.starredIds.includes(tech.id);
                    return (
                      <div
                        className={`w-full p-3 sm:p-4 rounded-2xl border flex items-center justify-between gap-2 ${
                          isStarred
                            ? "bg-amber-50 border-brand-gold ring-1 ring-brand-gold/30"
                            : index === 0
                            ? "bg-brand-lightGold border-brand-borderGold"
                            : "bg-brand-warmIvory border-brand-borderLight"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <GripVertical size={16} className="text-slate-300 shrink-0" />
                          <div
                            className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center font-serif font-bold text-sm ${
                              index === 0 ? "bg-brand-gold text-white shadow-sm" : "bg-white text-brand-charcoal border border-brand-borderLight"
                            }`}
                          >
                            #{index + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-brand-charcoal text-base flex items-center gap-1.5">
                              <span className="truncate">{tech.name}</span>
                              {isStarred && <span className="text-brand-gold font-black">★</span>}
                            </div>
                            {index === 0 && (
                              <span className="text-[10px] uppercase tracking-wider font-bold bg-brand-gold text-white px-2 py-0.5 rounded-full">Next Up</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => toggleStar(tech.id)}
                            className={`w-9 h-9 rounded-xl text-base font-bold flex items-center justify-center ${
                              isStarred ? "bg-brand-gold text-white shadow-sm" : "bg-white border border-brand-borderLight text-brand-softSlate"
                            }`}
                            aria-label="Priority"
                          >
                            {isStarred ? "★" : "☆"}
                          </button>
                          <button onClick={() => callTechnician(tech.id)} className={callBtn + " px-4"}>CALL</button>
                        </div>
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
          {/* 4. HISTORY */}
          <section className="lg:col-span-2 bg-white rounded-3xl p-5 sm:p-6 border border-brand-borderLight shadow-sm">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-brand-borderLight">
              <div>
                <h2 className="font-serif text-xl font-bold text-brand-charcoal flex items-center gap-2">
                  <History size={16} className="text-brand-gold" /> Daily Turn History
                </h2>
                <p className="text-xs text-brand-softSlate mt-0.5">Logged calls for current business day</p>
              </div>
              <button
                disabled={data.history.length === 0}
                onClick={undoLastCall}
                className="px-3 sm:px-4 py-2 bg-brand-warmIvory border border-brand-borderLight text-rose-700 text-xs font-bold rounded-xl transition disabled:opacity-40 flex items-center gap-1.5 shrink-0"
              >
                <RotateCcw size={13} /> UNDO LAST CALL
              </button>
            </div>

            {data.history.length === 0 ? (
              <div className="p-8 text-center bg-brand-warmIvory rounded-2xl border border-dashed border-brand-borderLight text-brand-softSlate text-xs my-5">
                No turn calls recorded for today.
              </div>
            ) : (
              <div className="overflow-x-auto my-5">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-brand-warmIvory text-brand-softSlate uppercase text-[11px] tracking-wider border-b border-brand-borderLight">
                      <th className="p-3 font-semibold">Turn #</th>
                      <th className="p-3 font-semibold">Technician</th>
                      <th className="p-3 font-semibold">Date</th>
                      <th className="p-3 font-semibold text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-borderLight text-xs">
                    {[...data.history].reverse().map((entry) => (
                      <tr key={entry.id}>
                        <td className="p-3 font-serif font-bold text-brand-gold">#{entry.turnNo}</td>
                        <td className="p-3 font-bold text-brand-charcoal">{entry.techName}</td>
                        <td className="p-3 text-brand-softSlate">{formatDate(entry.timestamp)}</td>
                        <td className="p-3 text-right text-brand-softSlate font-mono">{formatTime(entry.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="space-y-6 sm:space-y-8">
            {/* 5. NEW DAY */}
            <section className="bg-white rounded-3xl p-5 sm:p-6 border border-brand-borderLight shadow-sm">
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
            </section>

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
      {message && (
        <div className="fixed left-4 right-4 bottom-4 sm:left-auto sm:right-6 sm:w-96 z-50 p-3.5 bg-brand-charcoal text-white text-sm rounded-xl shadow-lg flex items-center gap-2 border border-brand-gold/40 toast-in mb-safe">
          <CheckCircle2 size={16} className="text-brand-gold shrink-0" />
          {message}
        </div>
      )}
    </div>
  );
}
