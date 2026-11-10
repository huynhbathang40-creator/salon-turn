import { useState } from "react";
import { Check, X, Clock, ChevronDown, HandCoins, RotateCcw } from "lucide-react";

// "I've sent it" tip check. Customers tap after sending a tip; the tech / manager confirms
// once the money shows up. No amounts: it only records that a customer says they sent one.
// Entries live on the shared board (data.tips), so every device sees them live.

const KEEP = 400; // older entries are dropped so the board stays small

// the entry is made once outside the updater, because the store may run the updater more than once
export function newTipEntry(tech, method, id) {
  return { id, techId: tech.id, techName: tech.name, method, at: new Date().toISOString(), status: "pending" };
}

export function addTipEntry(board, entry) {
  if ((board.tips || []).some((t) => t.id === entry.id)) return board;
  return { ...board, tips: [...(board.tips || []), { ...entry, date: board.businessDate }].slice(-KEEP) };
}

export function setTipEntryStatus(board, id, status) {
  return { ...board, tips: (board.tips || []).map((t) => (t.id === id ? { ...t, status, checkedAt: new Date().toISOString() } : t)) };
}

export const todaysTips = (board) => (board.tips || []).filter((t) => t.date === board.businessDate);

const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const methodLabel = { zelle: "Zelle", venmo: "Venmo" };

/** Manager panel on the Tips tab: pending checks first, then today's totals per tech */
export function TipCheckPanel({ tips, onStatus }) {
  const [showDone, setShowDone] = useState(false);
  const pending = tips.filter((t) => t.status === "pending").slice().reverse();
  const done = tips.filter((t) => t.status !== "pending").slice().reverse();
  const perTech = {};
  for (const t of tips) if (t.status === "ok") perTech[t.techName] = (perTech[t.techName] || 0) + 1;

  return (
    <div className="max-w-xl mx-auto rounded-2xl border border-brand-borderLight bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-bold text-brand-charcoal flex items-center gap-2">
          <HandCoins size={17} className="text-brand-gold" /> Today's tip check
        </span>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${pending.length ? "bg-amber-100 text-amber-900" : "bg-emerald-50 text-emerald-800"}`}>
          {pending.length ? `${pending.length} to check` : "All checked"}
        </span>
      </div>

      {tips.length === 0 && (
        <p className="text-sm text-brand-softSlate">When a customer taps “I've sent it”, it shows up here so the tech can confirm.</p>
      )}

      {pending.length > 0 && (
        <ul className="divide-y divide-brand-borderLight border-y border-brand-borderLight">
          {pending.map((t) => (
            <li key={t.id} className="py-2.5 flex items-center gap-2.5">
              <Clock size={16} className="text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-brand-charcoal truncate">{t.techName}</div>
                <div className="text-xs text-brand-softSlate">{time(t.at)} · {methodLabel[t.method] || "Tip"}</div>
              </div>
              <button onClick={() => onStatus(t.id, "ok")} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 active:scale-95">
                <Check size={14} /> Received
              </button>
              <button onClick={() => onStatus(t.id, "no")} className="p-2 rounded-xl border border-rose-200 text-rose-700 active:scale-95" aria-label={`Not received for ${t.techName}`}>
                <X size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {Object.keys(perTech).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(perTech).sort((a, b) => b[1] - a[1]).map(([name, n]) => (
            <span key={name} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-900">
              {name} · {n} tip{n > 1 ? "s" : ""}
            </span>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div>
          <button onClick={() => setShowDone((v) => !v)} className="text-xs text-brand-softSlate flex items-center gap-1">
            <ChevronDown size={14} className={`transition ${showDone ? "rotate-180" : ""}`} /> Checked today ({done.length})
          </button>
          {showDone && (
            <ul className="mt-2 space-y-1.5">
              {done.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  {t.status === "ok" ? <Check size={14} className="text-emerald-600" /> : <X size={14} className="text-rose-600" />}
                  <span className="font-semibold text-brand-charcoal">{t.techName}</span>
                  <span className="text-xs text-brand-softSlate">{time(t.at)} · {methodLabel[t.method] || "Tip"}</span>
                  <span className={`ml-auto text-[11px] font-bold ${t.status === "ok" ? "text-emerald-700" : "text-rose-700"}`}>
                    {t.status === "ok" ? "Received" : "Not received"}
                  </span>
                  <button onClick={() => onStatus(t.id, "pending")} className="text-[11px] underline text-brand-softSlate">Undo</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Owner only: every tip check by day — tech, when the customer sent it, when it was received */
export function TipHistory({ tips, onReset }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [open, setOpen] = useState(false); // hidden by default: the owner mostly checks reviews, not tips
  const [openDay, setOpenDay] = useState(null);
  const [view, setView] = useState("tech"); // tech | time
  const byDay = new Map();
  for (const t of (tips || []).slice().sort((x, y) => (x.at < y.at ? 1 : -1))) {
    if (!byDay.has(t.date)) byDay.set(t.date, []);
    byDay.get(t.date).push(t);
  }
  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const shown = openDay ?? days[0]?.[0];

  return (
    <div className="max-w-xl mx-auto rounded-2xl border border-brand-borderGold bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-bold text-brand-charcoal flex items-center gap-2">
          <Clock size={17} className="text-brand-gold" /> Tip history
          <span className="text-xs font-semibold text-brand-softSlate">({(tips || []).length})</span>
        </span>
        <span className="flex items-center gap-1.5">
        {onReset && (tips || []).length > 0 && (
          <button onClick={() => setConfirmReset(true)} className="px-2.5 py-1.5 rounded-full border border-rose-200 text-rose-700 text-xs font-bold inline-flex items-center gap-1">
            <RotateCcw size={12} /> Reset
          </button>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="px-3 py-1.5 rounded-full border border-brand-borderLight text-xs font-bold text-brand-charcoal flex items-center gap-1"
        >
          {open ? "Hide" : "Show"} <ChevronDown size={14} className={`transition ${open ? "rotate-180" : ""}`} />
        </button>
        </span>
      </div>

      {confirmReset && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm">
          <p className="font-bold text-rose-800">Delete all {(tips || []).length} tip records and start fresh?</p>
          <p className="text-rose-800/80 text-xs mt-0.5">This clears the tip history on every device. It can't be undone.</p>
          <div className="flex gap-2 mt-2.5">
            <button onClick={() => { onReset(); setConfirmReset(false); }} className="px-3.5 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold">Yes, reset tip history</button>
            <button onClick={() => setConfirmReset(false)} className="px-3.5 py-2 rounded-lg border border-brand-borderLight bg-white text-xs font-bold">Cancel</button>
          </div>
        </div>
      )}

      {open && (<>

      {days.length === 0 ? (
        <p className="text-sm text-brand-softSlate">No tips yet.</p>
      ) : (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {days.map(([d, list]) => (
              <button
                key={d}
                onClick={() => setOpenDay(d)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border ${d === shown ? "bg-brand-charcoal text-white border-brand-charcoal" : "bg-white text-brand-softSlate border-brand-borderLight"}`}
              >
                {d} · {list.length}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 bg-brand-warmIvory border border-brand-borderLight rounded-xl p-1">
            {[["tech", "By technician"], ["time", "By time"]].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setView(k)}
                className={`py-2 rounded-lg text-sm font-bold transition ${view === k ? "bg-white text-brand-charcoal shadow-sm" : "text-brand-softSlate"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {view === "time" ? (
            <TipRows list={byDay.get(shown) || []} showName />
          ) : (
            <div className="space-y-3">
              {groupByTech(byDay.get(shown) || []).map((g) => (
                <div key={g.name} className="rounded-xl border border-brand-borderLight overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-brand-warmIvory">
                    <span className="font-bold text-brand-charcoal">{g.name}</span>
                    <span className="text-xs text-brand-softSlate">
                      <b className="text-emerald-700">{g.ok}</b> received · {g.list.length} total
                    </span>
                  </div>
                  <div className="px-2"><TipRows list={g.list} /></div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      </>)}
    </div>
  );
}

function groupByTech(list) {
  const map = new Map();
  for (const t of list) {
    if (!map.has(t.techName)) map.set(t.techName, { name: t.techName, list: [], ok: 0 });
    const g = map.get(t.techName);
    g.list.push(t);
    if (t.status === "ok") g.ok++;
  }
  return [...map.values()].sort((a, b) => b.ok - a.ok || a.name.localeCompare(b.name));
}

function TipRows({ list, showName = false }) {
  const cols = "grid-cols-[minmax(0,1fr)_auto_auto]";
  return (
    <>
      <div className={`grid ${cols} gap-x-3 text-[11px] font-bold uppercase tracking-wider text-brand-softSlate px-1 pt-2 pb-1`}>
        <span>{showName ? "Technician" : "Method"}</span><span className="text-right">Sent</span><span className="text-right w-[92px]">Received</span>
      </div>
      <ul className="divide-y divide-brand-borderLight border-t border-brand-borderLight">
        {list.map((t) => (
          <li key={t.id} className={`grid ${cols} gap-x-3 items-center py-2.5 px-1 text-sm`}>
            <span className="min-w-0">
              {showName && <span className="font-bold text-brand-charcoal block truncate">{t.techName}</span>}
              <span className={showName ? "text-[11px] text-brand-softSlate" : "text-brand-charcoal"}>{methodLabel[t.method] || "Tip"}</span>
            </span>
            <span className="text-right text-brand-charcoal tabular-nums">{time(t.at)}</span>
            <span className="text-right w-[92px] tabular-nums">
              {t.status === "ok" ? (
                <span className="text-emerald-700 font-semibold">{t.checkedAt ? time(t.checkedAt) : "Received"}</span>
              ) : t.status === "no" ? (
                <span className="text-rose-700 font-semibold text-xs">Not received</span>
              ) : (
                <span className="text-amber-700 font-semibold text-xs">Pending</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
