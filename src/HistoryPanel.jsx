import { useMemo, useState, useEffect } from "react";
import { History, RotateCcw, Users, ListOrdered, Clock, BarChart3, Pencil, X, Copy, Check } from "lucide-react";
import { staffOrder } from "./staff.js";

const formatTime = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const formatShort = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const isSmall = (e) => e.kind === "small";
const byTime = (a, b) => new Date(a.timestamp) - new Date(b.timestamp);

function gapText(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Group a day's customers by technician (A–Z, owners last)
function groupByTech(history, technicians) {
  const groups = new Map();
  for (const e of [...history].sort(byTime)) {
    const key = e.techId || e.techName;
    if (!groups.has(key)) {
      const current = technicians.find((t) => t.id === e.techId);
      groups.set(key, { key, name: current?.name || e.techName, entries: [] });
    }
    groups.get(key).entries.push(e);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, turns: g.entries.filter((e) => !isSmall(e)).length, small: g.entries.filter(isSmall).length }))
    .sort((a, b) => staffOrder(a.name, b.name));
}

const tabBtn = (active) =>
  `flex-1 sm:flex-none px-2.5 sm:px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
    active ? "bg-white text-brand-charcoal shadow-sm" : "text-brand-softSlate"
  }`;

const KindTag = ({ e }) =>
  isSmall(e) ? (
    <span className="text-[10px] font-bold px-1.5 py-px rounded bg-sky-100 text-sky-800 whitespace-nowrap">&lt;$30</span>
  ) : (
    <span className="text-[10px] font-bold px-1.5 py-px rounded bg-brand-lightGold text-brand-gold whitespace-nowrap">TURN</span>
  );

export default function HistoryPanel({ data, archive, onUndoLastCall, onEditTime, canEdit = true }) {
  const [view, setView] = useState("tech"); // "tech" | "time" | "summary"
  const [dayId, setDayId] = useState("today");
  const [techKey, setTechKey] = useState("all");
  const [editing, setEditing] = useState(null); // history entry whose time is being changed

  const day = dayId === "today" ? null : archive.find((a) => a.id === dayId);
  const history = day ? day.history || [] : data.history;
  const dateLabel = day ? day.date : data.businessDate;
  const isToday = !day;
  const canEditTime = isToday && canEdit && Boolean(onEditTime);

  const groups = useMemo(() => groupByTech(history, data.technicians), [history, data.technicians]);
  const shown = techKey === "all" ? groups : groups.filter((g) => g.key === techKey);
  const smallTotal = history.filter(isSmall).length;

  function pickDay(id) {
    setDayId(id);
    setTechKey("all");
  }

  const editBtn = (e) =>
    canEditTime ? (
      <button onClick={() => setEditing(e)} className="shrink-0 w-8 h-8 rounded-lg bg-white border border-brand-borderLight text-brand-softSlate flex items-center justify-center" aria-label="Change time">
        <Pencil size={13} />
      </button>
    ) : null;

  return (
    <section className="lg:col-span-2 bg-white rounded-3xl p-4 sm:p-6 border border-brand-borderLight shadow-sm">
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-brand-borderLight">
        <div className="min-w-0">
          <h2 className="font-serif text-xl font-bold text-brand-charcoal flex items-center gap-2">
            <History size={16} className="text-brand-gold" /> Turn History
          </h2>
          <p className="text-xs text-brand-softSlate mt-0.5">Every customer and the exact time</p>
        </div>
        {isToday && canEdit && (
          <button
            disabled={data.history.length === 0}
            onClick={onUndoLastCall}
            className="px-3 sm:px-4 py-2 bg-brand-warmIvory border border-brand-borderLight text-rose-700 text-xs font-bold rounded-xl transition disabled:opacity-40 flex items-center gap-1.5 shrink-0"
          >
            <RotateCcw size={13} /> UNDO
          </button>
        )}
      </div>

      {/* controls: day + view */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 mt-4">
        <select
          value={dayId}
          onChange={(e) => pickDay(e.target.value)}
          className="bg-brand-warmIvory border border-brand-borderLight rounded-xl px-3 py-2 text-base sm:text-sm font-semibold text-brand-charcoal focus:outline-none focus:border-brand-gold"
          aria-label="Choose day"
        >
          <option value="today">Today · {data.businessDate}</option>
          {archive.map((a) => (
            <option key={a.id} value={a.id}>
              {a.date} · {(a.history || []).length} customers
            </option>
          ))}
        </select>
        <div className="flex bg-brand-warmIvory border border-brand-borderLight rounded-xl p-1 sm:ml-auto">
          <button onClick={() => setView("tech")} className={tabBtn(view === "tech")}>
            <Users size={13} /> By tech
          </button>
          <button onClick={() => setView("time")} className={tabBtn(view === "time")}>
            <ListOrdered size={13} /> By time
          </button>
          <button onClick={() => setView("summary")} className={tabBtn(view === "summary")}>
            <BarChart3 size={13} /> Summary
          </button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="p-8 text-center bg-brand-warmIvory rounded-2xl border border-dashed border-brand-borderLight text-brand-softSlate text-xs my-5">
          No customers recorded for {isToday ? "today" : dateLabel}.
        </div>
      ) : view === "summary" ? (
        <Summary groups={groups} total={history.length} small={smallTotal} dateLabel={dateLabel} />
      ) : view === "tech" ? (
        <div className="mt-4">
          {/* tech filter */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              onClick={() => setTechKey("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border ${
                techKey === "all" ? "bg-brand-charcoal text-white border-brand-charcoal" : "bg-white text-brand-charcoal border-brand-borderLight"
              }`}
            >
              All · {history.length}
            </button>
            {groups.map((g) => (
              <button
                key={g.key}
                onClick={() => setTechKey(g.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border ${
                  techKey === g.key ? "bg-brand-gold text-white border-brand-gold" : "bg-white text-brand-charcoal border-brand-borderLight"
                }`}
              >
                {g.name} · {g.entries.length}
              </button>
            ))}
          </div>

          <div className={`grid gap-3 mt-3 ${shown.length > 1 ? "md:grid-cols-2" : ""}`}>
            {shown.map((g) => {
              const first = g.entries[0];
              const last = g.entries[g.entries.length - 1];
              return (
                <div key={g.key} className="rounded-2xl border border-brand-borderLight bg-brand-warmIvory/60 overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-4 py-3 bg-white border-b border-brand-borderLight">
                    <div className="min-w-0">
                      <div className="font-bold text-brand-charcoal text-base truncate">{g.name}</div>
                      <div className="text-[11px] text-brand-softSlate flex items-center gap-1">
                        <Clock size={11} /> {formatShort(first.timestamp)}
                        {g.entries.length > 1 && <> – {formatShort(last.timestamp)}</>}
                      </div>
                    </div>
                    <span className="shrink-0 px-2.5 py-1 rounded-full bg-brand-lightGold border border-brand-borderGold text-xs font-bold text-brand-gold whitespace-nowrap">
                      {g.turns} {g.turns === 1 ? "turn" : "turns"}{g.small ? ` + ${g.small}` : ""}
                    </span>
                  </div>
                  <ol className="divide-y divide-brand-borderLight">
                    {g.entries.map((e, i) => {
                      const prev = g.entries[i - 1];
                      return (
                        <li key={e.id || i} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                            <span className="w-8 shrink-0 text-xs font-bold text-brand-softSlate">{ordinal(i + 1)}</span>
                            <KindTag e={e} />
                            <span className="hidden min-[400px]:inline text-xs text-brand-softSlate whitespace-nowrap">#{e.turnNo}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <div className="font-mono text-[13px] sm:text-sm text-brand-charcoal font-semibold whitespace-nowrap">{formatTime(e.timestamp)}</div>
                              {e.edited ? (
                                <div className="text-[10px] text-amber-700 whitespace-nowrap">edited · was {formatShort(e.originalTimestamp)}</div>
                              ) : prev ? (
                                <div className="text-[11px] text-brand-softSlate whitespace-nowrap">+{gapText(new Date(e.timestamp) - new Date(prev.timestamp))}</div>
                              ) : null}
                            </div>
                            {editBtn(e)}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-brand-borderLight border border-brand-borderLight rounded-2xl overflow-hidden">
          {[...history].sort(byTime).reverse().map((e, i) => (
            <li key={e.id || i} className="flex items-center gap-3 px-3 sm:px-4 py-2.5 bg-white">
              <span className="w-9 shrink-0 font-serif font-bold text-brand-gold text-sm">#{e.turnNo}</span>
              <span className="flex-1 min-w-0 flex items-center gap-2">
                <span className="font-bold text-brand-charcoal text-sm truncate">{e.techName}</span>
                <KindTag e={e} />
              </span>
              <span className="text-right">
                <span className="block font-mono text-sm text-brand-softSlate whitespace-nowrap">{formatTime(e.timestamp)}</span>
                {e.edited && <span className="block text-[10px] text-amber-700 whitespace-nowrap">edited · was {formatShort(e.originalTimestamp)}</span>}
              </span>
              {editBtn(e)}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <TimeEditor
          entry={editing}
          onClose={() => setEditing(null)}
          onSave={(iso) => {
            onEditTime(editing.id, iso);
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

/* ---------- daily summary: turns + under-$30 = customers, per tech and for the salon ---------- */

function Summary({ groups, total, small, dateLabel }) {
  const [copied, setCopied] = useState(false);
  const max = Math.max(1, ...groups.map((g) => g.entries.length));
  const turns = total - small;

  const stats = groups.map((g) => {
    const t = g.entries.map((e) => new Date(e.timestamp).getTime());
    const gaps = t.slice(1).map((x, i) => x - t[i]);
    return { ...g, first: g.entries[0].timestamp, last: g.entries[g.entries.length - 1].timestamp, avgGap: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null };
  });

  function copy() {
    const lines = [
      `Customers ${dateLabel}: ${total} (${turns} turns + ${small} under $30)`,
      ...stats.map((s) => `${s.name}: ${s.turns}${s.small ? ` + ${s.small}` : ""} = ${s.entries.length}`),
    ];
    navigator.clipboard?.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const box = "rounded-2xl border p-3 text-center";
  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className={box + " bg-brand-charcoal border-brand-charcoal text-white"}>
          <div className="text-[10px] sm:text-[11px] uppercase tracking-wider opacity-70">Customers</div>
          <div className="font-serif text-3xl font-bold">{total}</div>
        </div>
        <div className={box + " bg-brand-lightGold border-brand-borderGold"}>
          <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-brand-softSlate">Turns ($30+)</div>
          <div className="font-serif text-3xl font-bold text-brand-gold">{turns}</div>
        </div>
        <div className={box + " bg-sky-50 border-sky-200"}>
          <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-sky-800/70">Under $30</div>
          <div className="font-serif text-3xl font-bold text-sky-800">{small}</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[11px] text-brand-softSlate">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-brand-gold" /> Turn</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-sky-400" /> Under $30</span>
        </div>
        <button onClick={copy} className="px-3 py-1.5 rounded-lg border border-brand-borderLight text-xs font-bold text-brand-charcoal flex items-center gap-1.5">
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy summary"}
        </button>
      </div>

      <ul className="space-y-2">
        {stats.map((s) => (
          <li key={s.key} className="rounded-2xl border border-brand-borderLight bg-brand-warmIvory/60 px-3.5 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-brand-charcoal truncate">{s.name}</span>
              <span className="shrink-0 text-sm text-brand-softSlate whitespace-nowrap">
                <b className="text-brand-gold">{s.turns}</b>
                {s.small ? <> + <b className="text-sky-700">{s.small}</b></> : null} = <b className="text-brand-charcoal text-base">{s.entries.length}</b>
              </span>
            </div>
            <div className="mt-2 h-2.5 rounded-full bg-brand-borderLight/70 overflow-hidden flex" aria-hidden="true">
              <div className="h-full bg-brand-gold" style={{ width: `${(s.turns / max) * 100}%` }} />
              <div className="h-full bg-sky-400" style={{ width: `${(s.small / max) * 100}%` }} />
            </div>
            <div className="mt-1.5 text-[11px] text-brand-softSlate flex flex-wrap gap-x-3">
              <span>{formatShort(s.first)}{s.entries.length > 1 ? ` – ${formatShort(s.last)}` : ""}</span>
              {s.avgGap != null && <span>every ~{gapText(s.avgGap)}</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- change the time of one customer (when CALL was tapped late) ---------- */

function TimeEditor({ entry, onClose, onSave }) {
  const d = new Date(entry.timestamp);
  const pad = (n) => String(n).padStart(2, "0");
  const [value, setValue] = useState(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function save(e) {
    e.preventDefault();
    const m = /^(\d{1,2}):(\d{2})$/.exec(value);
    if (!m) return setError("Pick a time.");
    const next = new Date(entry.timestamp);
    next.setHours(Number(m[1]), Number(m[2]), 0, 0);
    if (next.getTime() > Date.now() + 60000) return setError("That time is in the future.");
    onSave(next.toISOString());
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 pb-safe relative toast-in space-y-4">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-brand-warmIvory flex items-center justify-center" aria-label="Close">
          <X size={18} />
        </button>
        <div>
          <h3 className="font-serif text-xl font-bold text-brand-charcoal pr-10">Change time</h3>
          <p className="text-sm text-brand-softSlate mt-1 flex items-center gap-2">
            <b className="text-brand-charcoal">{entry.techName}</b> <KindTag e={entry} /> #{entry.turnNo}
          </p>
          <p className="text-xs text-brand-softSlate mt-1">
            Saved as {formatTime(entry.timestamp)}
            {entry.edited && <> · first recorded {formatTime(entry.originalTimestamp)}</>}
          </p>
        </div>
        <input
          type="time"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(""); }}
          className="w-full bg-brand-warmIvory border border-brand-borderLight rounded-2xl px-4 py-4 text-3xl font-bold text-center text-brand-charcoal focus:outline-none focus:border-brand-gold"
          required
        />
        {error && <p className="text-sm text-rose-700">{error}</p>}
        <button type="submit" className="w-full py-3.5 rounded-2xl bg-brand-gold text-white font-bold">Save time</button>
      </form>
    </div>
  );
}
