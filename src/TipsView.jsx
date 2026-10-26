import { useEffect, useMemo, useState } from "react";
import { Search, X, Copy, Check, QrCode, Loader2, Heart, Pencil, AlertCircle } from "lucide-react";
import Avatar from "./Avatar.jsx";
import { useTipRows, getQr, tipKey } from "./tips.js";

// Tip directory. The list of people comes from the turn board (one shared staff list);
// each person's Zelle / Venmo comes from the tip info saved for that name.
export default function TipsView({ technicians = [], canEdit = false, onEditTech }) {
  const { rows, loadError } = useTipRows();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  const people = useMemo(() => {
    const byKey = new Map((rows || []).map((r) => [r.name_key || tipKey(r.name), r]));
    return technicians.map((t) => ({ tech: t, tip: byKey.get(tipKey(t.name)) || null }));
  }, [technicians, rows]);

  const q = query.trim().toLowerCase();
  // customers only see people who can receive tips; the manager also sees who is missing info
  const visible = people.filter((p) => (canEdit || p.tip) && (!q || p.tech.name.toLowerCase().includes(q)));
  const missing = people.filter((p) => !p.tip);

  return (
    <div className="space-y-5">
      <div className="text-center pt-2">
        <h2 className="font-serif text-3xl font-bold text-brand-charcoal">Select Your Specialist</h2>
        <p className="text-sm text-brand-softSlate mt-1">Tap a name to tip with Zelle or Venmo</p>
      </div>

      {canEdit && rows && missing.length > 0 && (
        <div className="max-w-xl mx-auto p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex gap-2.5">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span>
            No Zelle or Venmo yet: <strong>{missing.map((p) => p.tech.name).join(", ")}</strong>. Tap their card to add it. Customers don't see them until then.
          </span>
        </div>
      )}

      <div className="relative max-w-md mx-auto">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-softSlate" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search technician..."
          className="w-full bg-white border border-brand-borderLight rounded-full pl-11 pr-4 py-3 text-base sm:text-sm shadow-sm focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold"
        />
      </div>

      {loadError && !rows && <p className="text-center text-sm text-rose-700">Could not load tip info. Check the internet connection.</p>}
      {!rows && !loadError && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-brand-gold" /></div>}

      {rows && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {visible.map(({ tech, tip }) => (
            <button
              key={tech.id}
              onClick={() => (tip ? setSelected({ tech, tip }) : onEditTech?.(tech.name))}
              className={`bg-white rounded-2xl border shadow-sm p-4 flex flex-col items-center gap-2 active:scale-[0.98] transition ${tip ? "border-brand-borderLight" : "border-dashed border-amber-300"}`}
            >
              <Avatar name={tech.name} size={72} />
              <span className="font-bold text-brand-charcoal text-base">{tech.name}</span>
              {tip ? (
                <span className="w-full py-2 rounded-full bg-brand-charcoal text-white text-xs font-bold flex items-center justify-center gap-1.5">
                  <Heart size={12} /> Tip {tech.name.split(" ")[0]}
                </span>
              ) : (
                <span className="w-full py-2 rounded-full bg-amber-100 text-amber-900 text-xs font-bold flex items-center justify-center gap-1.5">
                  <Pencil size={12} /> Add Zelle / Venmo
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {rows && visible.length === 0 && (
        <p className="text-center text-sm text-brand-softSlate py-6">{q ? `No technician named "${query}".` : "No technicians yet."}</p>
      )}

      {selected && (
        <TipModal
          name={selected.tech.name}
          tip={selected.tip}
          canEdit={canEdit}
          onEdit={() => { setSelected(null); onEditTech?.(selected.tech.name); }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function TipModal({ name, tip, onClose, canEdit, onEdit }) {
  const key = tip.name_key || tipKey(tip.name);
  const [qr, setQr] = useState(null);
  const [method, setMethod] = useState(tip.zelle ? "zelle" : tip.venmo ? "venmo" : "zelle");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    getQr(key)
      .then((v) => {
        if (!alive) return;
        setQr(v);
        // open on whichever method this person actually has
        if (!tip.zelle && !v.zelle_qr && (tip.venmo || v.venmo_qr)) setMethod("venmo");
      })
      .catch((e) => { console.error(e); if (alive) setQr({ zelle_qr: null, venmo_qr: null }); });
    return () => { alive = false; };
  }, [key, tip.zelle, tip.venmo]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hasZelle = Boolean(tip.zelle || qr?.zelle_qr);
  const hasVenmo = Boolean(tip.venmo || qr?.venmo_qr);
  const image = method === "zelle" ? qr?.zelle_qr : qr?.venmo_qr;
  const handle = method === "zelle" ? tip.zelle : tip.venmo ? "@" + tip.venmo.replace(/^@/, "") : "";
  const color = method === "zelle" ? "#7414ca" : "#008CFF";

  function copy() {
    const text = method === "zelle" ? tip.zelle : (tip.venmo || "").replace(/^@/, "");
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 pb-safe max-h-[94vh] overflow-y-auto relative toast-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-brand-warmIvory flex items-center justify-center" aria-label="Close">
          <X size={18} />
        </button>

        <div className="text-center">
          <Avatar name={name} size={72} ring="border-brand-gold" />
          <h3 className="font-bold text-xl text-brand-charcoal mt-2">{name}</h3>
          {canEdit && (
            <button onClick={onEdit} className="mt-1 text-[11px] text-brand-softSlate underline">
              Edit Zelle / Venmo / picture
            </button>
          )}
        </div>

        {hasZelle && hasVenmo && (
          <div className="grid grid-cols-2 gap-2 mt-5">
            {["zelle", "venmo"].map((m) => (
              <button
                key={m}
                onClick={() => { setMethod(m); setCopied(false); }}
                className="py-2.5 rounded-xl border-2 font-bold text-sm capitalize"
                style={method === m ? { borderColor: m === "zelle" ? "#7414ca" : "#008CFF", color: m === "zelle" ? "#7414ca" : "#008CFF", background: m === "zelle" ? "#f3e8ff" : "#e6f4ff" } : { borderColor: "#E8E8EC", color: "#4A4A52" }}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-col items-center">
          <p className="text-xs font-bold tracking-wider mb-2" style={{ color }}>
            {image || !qr ? `SCAN ${method.toUpperCase()} QR CODE` : method.toUpperCase()}
          </p>
          <div className="rounded-2xl p-3 bg-white border-2 border-dashed" style={{ borderColor: color }}>
            {!qr ? (
              <div className="w-[min(70vw,280px)] aspect-square flex items-center justify-center"><Loader2 className="animate-spin" style={{ color }} /></div>
            ) : image ? (
              <img src={image} alt={`${name} ${method} QR code`} className="w-[min(70vw,280px)] aspect-square object-contain" />
            ) : (
              <div className="w-[min(70vw,280px)] aspect-[2/1] flex flex-col items-center justify-center text-brand-softSlate text-xs gap-2">
                <QrCode size={28} className="opacity-30" /> No QR code, use the info below
              </div>
            )}
          </div>
        </div>

        {handle && (
          <div className="mt-5 bg-brand-warmIvory rounded-2xl p-4 text-center border border-dashed border-brand-borderLight">
            <div className="text-[11px] uppercase tracking-wider text-brand-softSlate">{method === "zelle" ? "Zelle phone / email" : "Venmo username"}</div>
            <div className="text-lg font-bold text-brand-charcoal break-all mt-0.5">{handle}</div>
            <button onClick={copy} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-charcoal text-white text-sm font-bold">
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}

        <p className="text-[11px] text-brand-softSlate text-center mt-4">
          {method === "zelle" ? "Scan with your bank app, or copy the Zelle info." : "Scan with the Venmo app, or copy the username."}
        </p>
      </div>
    </div>
  );
}
