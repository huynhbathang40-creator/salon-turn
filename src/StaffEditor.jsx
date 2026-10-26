import { useEffect, useRef, useState } from "react";
import { X, Loader2, QrCode, Upload, Trash2 } from "lucide-react";
import Avatar from "./Avatar.jsx";
import { getQr, saveStaff, deleteStaff, qrFileToDataUrl } from "./staff.js";

// One form for a technician: name + Zelle + Venmo (+ QR pictures). Used when adding a tech and when editing.
// Rule: every tech needs Zelle or Venmo (at least one), because some techs only use one of them.
export default function StaffEditor({ staff, initialName = "", title, allowDelete = false, onSaved, onDeleted, onClose }) {
  const [name, setName] = useState(staff?.name || initialName);
  const [zelle, setZelle] = useState(staff?.zelle || "");
  const [venmo, setVenmo] = useState(staff?.venmo || "");
  // undefined = unchanged, "" = removed, "data:..." = new picture
  const [zelleQr, setZelleQr] = useState(undefined);
  const [venmoQr, setVenmoQr] = useState(undefined);
  const [saved, setSaved] = useState({ zelle_qr: null, venmo_qr: null }); // pictures already stored
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (staff?.id && (staff.has_zelle_qr || staff.has_venmo_qr)) getQr(staff.id).then(setSaved).catch(() => {});
  }, [staff?.id, staff?.has_zelle_qr, staff?.has_venmo_qr]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shownZelleQr = zelleQr === undefined ? saved.zelle_qr : zelleQr;
  const shownVenmoQr = venmoQr === undefined ? saved.venmo_qr : venmoQr;

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Please enter the technician's name.");
    if (!zelle.trim() && !shownZelleQr && !venmo.trim() && !shownVenmoQr)
      return setError("Add Zelle or Venmo (at least one) so customers can tip.");
    setBusy(true);
    try {
      const id = await saveStaff({ id: staff?.id, name: name.trim(), role: staff?.role || "Nailtech", zelle, venmo, zelleQr, venmoQr });
      await onSaved?.({ id, name: name.trim(), previousName: staff?.name });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    setBusy(true);
    try {
      await deleteStaff(staff.id);
      onDeleted?.(staff);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[65] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 pb-safe max-h-[94vh] overflow-y-auto relative toast-in space-y-4"
      >
        <button type="button" onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-brand-warmIvory flex items-center justify-center" aria-label="Close">
          <X size={18} />
        </button>
        <div className="flex items-center gap-3 pr-10">
          <Avatar name={name || "?"} size={48} />
          <h3 className="font-bold text-lg text-brand-charcoal">{title || (staff ? "Edit technician" : "New technician")}</h3>
        </div>

        <label className="block">
          <span className="text-xs font-bold text-brand-softSlate uppercase tracking-wider">Name *</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Kelly"
            className="mt-1 w-full bg-brand-warmIvory border border-brand-borderLight rounded-xl px-4 py-2.5 text-base font-semibold focus:outline-none focus:border-brand-gold"
          />
        </label>

        <PayBlock
          label="Zelle"
          color="#7414ca"
          bg="#f8f3fc"
          placeholder="Phone number or email"
          value={zelle}
          onChange={setZelle}
          qr={shownZelleQr}
          onQr={setZelleQr}
          onError={setError}
        />
        <PayBlock
          label="Venmo"
          color="#008CFF"
          bg="#eef7ff"
          placeholder="Username (without @)"
          value={venmo}
          onChange={(v) => setVenmo(v.replace(/^@/, ""))}
          qr={shownVenmoQr}
          onQr={setVenmoQr}
          onError={setError}
        />
        <p className="text-[11px] text-brand-softSlate -mt-1">Fill in Zelle, Venmo, or both. At least one is required.</p>

        {error && <p className="text-sm text-rose-700">{error}</p>}

        <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-brand-charcoal text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
          {busy && <Loader2 size={16} className="animate-spin" />} Save
        </button>

        {allowDelete && staff && (
          !confirmDelete ? (
            <button type="button" onClick={() => setConfirmDelete(true)} className="w-full py-2.5 rounded-xl border border-rose-200 text-rose-700 text-sm font-semibold flex items-center justify-center gap-1.5">
              <Trash2 size={14} /> Remove {staff.name} from Tips
            </button>
          ) : (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
              <p className="text-sm text-rose-900">Delete {staff.name}'s Zelle/Venmo info? This cannot be undone.</p>
              <div className="flex gap-2">
                <button type="button" onClick={doDelete} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold">Yes, delete</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-sm font-semibold">Cancel</button>
              </div>
            </div>
          )
        )}
      </form>
    </div>
  );
}

function PayBlock({ label, color, bg, placeholder, value, onChange, qr, onQr, onError }) {
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(false);

  async function onFile(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setLoading(true);
    try {
      onQr(await qrFileToDataUrl(f));
    } catch (err) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl p-3.5 space-y-2.5 border border-dashed" style={{ background: bg, borderColor: color }}>
      <span className="text-sm font-bold" style={{ color }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect="off"
        className="w-full bg-white border border-brand-borderLight rounded-xl px-3 py-2.5 text-base focus:outline-none"
      />
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 shrink-0 rounded-lg bg-white border border-brand-borderLight flex items-center justify-center overflow-hidden">
          {loading ? <Loader2 size={18} className="animate-spin" style={{ color }} /> : qr ? <img src={qr} alt={`${label} QR`} className="w-full h-full object-contain" /> : <QrCode size={22} className="text-slate-300" />}
        </div>
        <div className="flex flex-col gap-1.5 items-start">
          <button type="button" onClick={() => fileRef.current?.click()} className="px-3 py-1.5 rounded-lg bg-white border text-xs font-bold flex items-center gap-1.5" style={{ borderColor: color, color }}>
            <Upload size={12} /> {qr ? "Change QR picture" : "Upload QR picture"}
          </button>
          {qr && (
            <button type="button" onClick={() => onQr("")} className="text-[11px] text-rose-700 underline">Remove QR</button>
          )}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </div>
  );
}
