import { useMemo, useState } from "react";
import { History, RotateCcw, Users, ListOrdered, Clock } from "lucide-react";
import { staffOrder } from "./staff.js";

const formatTime = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const formatShort = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function gapText(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `+${min} min`;
  return `+${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Group a day's calls by technician (A–Z, owners last)
function groupByTech(history, technicians) {
  const groups = new Map();
  for (const e of [...history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))) {
    const key = e.techId || e.techName;
    if (!groups.has(key)) {
      const current = technicians.find((t) => t.id === e.techId);
      groups.set(key, { key, name: current?.name || e.techName, entries: [] });
    }
    groups.get(key).entries.push(e);
  }
  return [...groups.values()].sort((a, b) => staffOrder(a.name, b.name)); // A–Z, owners last
}

const tabBtn = (active) =>
  `flex-1 sm:flex-none px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
    active ? "bg-white text-brand-charcoal shadow-sm" : "text-brand-softSlate"
  }`;

export default function HistoryPanel({ data, archive, onUndoLastCall, canEdit = true }) {
  const [view, setView] = useState("tech"); // "tech" | "time"
  const [dayId, setDayId] = useState("today");
  const [techKey, setTechKey] = useState("all");

  const day = dayId === "today" ? null : archive.find((a) => a.id === dayId);
  const history = day ? day.history || [] : data.history;
  const dateLabel = day ? day.date : data.businessDate;
  const isToday = !day;

  const groups = useMemo(() => groupByTech(history, data.technicians), [history, data.technicians]);
  const shown = techKey === "all" ? groups : groups.filter((g) => g.key === techKey);

  function pickDay(id) {
    setDayId(id);
    setTechKey("all");
  }

  return (
    <section className="lg:col-span-2 bg-white rounded-3xl p-5 sm:p-6 border border-brand-borderLight shadow-sm">
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-brand-borderLight">
        <div>
          <h2 className="font-serif text-xl font-bold text-brand-charcoal flex items-center gap-2">
            <History size={16} className="text-brand-gold" /> Turn History
          </h2>
          <p className="text-xs text-brand-softSlate mt-0.5">Every turn and the exact time it was called</p>
        </div>
        {isToday && canEdit && (
          <button
            disabled={data.history.length === 0}
            onClick={onUndoLastCall}
            className="px-3 sm:px-4 py-2 bg-brand-warmIvory border border-brand-borderLight text-rose-700 text-xs font-bold rounded-xl transition disabled:opacity-40 flex items-center gap-1.5 shrink-0"
          >
            <RotateCcw size={13} /> UNDO LAST CALL
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
              {a.date} · {(a.history || []).length} calls
            </option>
          ))}
        </select>
        <div className="flex bg-brand-warmIvory border border-brand-borderLight rounded-xl p-1 sm:ml-auto">
          <button onClick={() => setView("tech")} className={tabBtn(view === "tech")}>
            <Users size={13} /> By technician
          </button>
          <button onClick={() => setView("time")} className={tabBtn(view === "time")}>
            <ListOrdered size={13} /> By time
          </button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="p-8 text-center bg-brand-warmIvory rounded-2xl border border-dashed border-brand-borderLight text-brand-softSlate text-xs my-5">
          No turn calls recorded for {isToday ? "today" : dateLabel}.
        </div>
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

          <div className={`grid gap-3 mt-3 ${shown.length > 1 ? "sm:grid-cols-2" : ""}`}>
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
                    <span className="shrink-0 px-2.5 py-1 rounded-full bg-brand-lightGold border border-brand-borderGold text-xs font-bold text-brand-gold">
                      {g.entries.length} {g.entries.length === 1 ? "turn" : "turns"}
                    </span>
                  </div>
                  <ol className="divide-y divide-brand-borderLight">
                    {g.entries.map((e, i) => {
                      const prev = g.entries[i - 1];
                      return (
                        <li key={e.id || i} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-11 shrink-0 text-xs font-bold text-brand-softSlate">{ordinal(i + 1)}</span>
                            <span className="text-xs text-brand-softSlate">Turn <span className="font-serif font-bold text-brand-gold text-sm">#{e.turnNo}</span></span>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-brand-charcoal font-semibold">{formatTime(e.timestamp)}</div>
                            {prev && (
                              <div className="text-[11px] text-brand-softSlate">
                                {gapText(new Date(e.timestamp) - new Date(prev.timestamp))} after last
                              </div>
                            )}
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
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-brand-warmIvory text-brand-softSlate uppercase text-[11px] tracking-wider border-b border-brand-borderLight">
                <th className="p-3 font-semibold">Turn #</th>
                <th className="p-3 font-semibold">Technician</th>
                <th className="p-3 font-semibold text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-borderLight text-sm">
              {[...history].reverse().map((entry, i) => (
                <tr key={entry.id || i}>
                  <td className="p-3 font-serif font-bold text-brand-gold">#{entry.turnNo}</td>
                  <td className="p-3 font-bold text-brand-charcoal">{entry.techName}</td>
                  <td className="p-3 text-right text-brand-softSlate font-mono">{formatTime(entry.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
