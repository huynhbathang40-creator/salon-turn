import { useEffect, useRef, useState } from "react";
import { X, Upload, Trash2, Loader2, Camera, QrCode, Sparkles, Check } from "lucide-react";
import Avatar from "./Avatar.jsx";
import AvatarEditor from "./AvatarEditor.jsx";
import { getQr, qrFileToDataUrl, tipKey, useTipRows } from "./tips.js";
import { cleanQr } from "./qrclean.js";

// Add or edit a technician: name + Zelle (phone/email, QR) + Venmo (username, QR) + picture.
// At least one way to receive tips (Zelle or Venmo) is required.
export default function TechEditor({ tech, initialName = "", technicians, onSave, onDelete, onClose }) {
  const isNew = !tech;
  const { rows } = useTipRows();
  const existing = tech ? (rows || []).find((r) => (r.name_key || tipKey(r.name)) === tipKey(tech.name)) : null;

  const [name, setName] = useState(tech?.name || initialName);
  const [zelle, setZelle] = useState(existing?.zelle || "");
  const [venmo, setVenmo] = useState(existing?.venmo || "");
  const [savedQr, setSavedQr] = useState({ zelle_qr: null, venmo_qr: null }); // pictures already saved
  const [zelleQr, setZelleQr] = useState(undefined); // undefined = keep saved, "" = remove, data URL = new
  const [venmoQr, setVenmoQr] = useState(undefined);
  const [loadingQr, setLoadingQr] = useState(Boolean(existing));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picture, setPicture] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const filled = useRef(false);

  // fill the form once the saved info arrives
  useEffect(() => {
    if (!existing || filled.current) return;
    filled.current = true;
    setZelle(existing.zelle || "");
    setVenmo(existing.venmo || "");
    getQr(existing.name_key || tipKey(existing.name))
      .then(setSavedQr)
      .catch(console.error)
      .finally(() => setLoadingQr(false));
  }, [existing]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shownZelleQr = zelleQr === undefined ? savedQr.zelle_qr : zelleQr;
  const shownVenmoQr = venmoQr === undefined ? savedQr.venmo_qr : venmoQr;

  async function submit(e) {
    e.preventDefault();
    setError("");
    const n = name.trim().replace(/\s+/g, " ");
    if (!n) return setError("Enter the technician's name.");
    if (technicians.some((t) => t.id !== tech?.id && tipKey(t.name) === tipKey(n))) return setError("Another technician already has this name.");
    // tip info is optional for new people; someone who already has it must keep at least one way to be tipped
    if (existing && !zelle.trim() && !venmo.trim() && !shownZelleQr && !shownVenmoQr)
      return setError("Keep Zelle or Venmo (at least one). To stop tips, remove the technician.");
    setBusy(true);
    try {
      await onSave({ oldName: tech?.name, name: n, zelle: zelle.trim(), zelleQr, venmo: venmo.trim().replace(/^@/, ""), venmoQr });
      onClose();
    } catch (err) {
      setError(err.message || "Could not save. Check the internet connection.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await onDelete(tech);
      onClose();
    } catch (err) {
      setError(err.message || "Could not remove.");
      setBusy(false);
    }
  }

  const input = "w-full bg-brand-warmIvory border border-brand-borderLight rounded-xl px-3.5 py-2.5 text-base sm:text-sm focus:outline-none focus:border-brand-gold";

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 pb-safe max-h-[94vh] overflow-y-auto relative toast-in space-y-4"
      >
        <button type="button" onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-brand-warmIvory flex items-center justify-center" aria-label="Close">
          <X size={18} />
        </button>
        <h3 className="font-serif text-xl font-bold text-brand-charcoal pr-10">{isNew ? "Add technician" : `Edit ${tech.name}`}</h3>

        {/* name + picture */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => (name.trim() ? setPicture(true) : setError("Enter the name first, then add a picture."))}
            className="relative shrink-0"
            aria-label="Change picture"
          >
            <Avatar name={name.trim() || "?"} size={60} />
            <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-brand-charcoal text-white flex items-center justify-center border-2 border-white">
              <Camera size={12} />
            </span>
          </button>
          <label className="flex-1 min-w-0">
            <span className="block text-xs font-bold text-brand-softSlate mb-1">Name *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kelly" className={input} autoFocus={isNew && !initialName} />
          </label>
        </div>

        <p className="text-xs text-brand-softSlate -mb-1">Tip info (optional for new technicians, can be added later): Zelle, Venmo, or both.</p>

        <PaymentBox
          label="Zelle"
          color="#7414ca"
          bg="#f8f3fc"
          placeholder="Phone number or email"
          value={zelle}
          onChange={setZelle}
          qr={shownZelleQr}
          loading={loadingQr}
          onQr={setZelleQr}
          onError={setError}
          inputClass={input}
        />
        <PaymentBox
          label="Venmo"
          color="#008CFF"
          bg="#eef7ff"
          placeholder="Username (without @)"
          value={venmo}
          onChange={setVenmo}
          qr={shownVenmoQr}
          loading={loadingQr}
          onQr={setVenmoQr}
          onError={setError}
          inputClass={input}
        />

        {error && <p className="text-sm text-rose-700">{error}</p>}

        <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-brand-gold text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
          {busy && <Loader2 size={16} className="animate-spin" />} {isNew ? "Add technician" : "Save changes"}
        </button>

        {!isNew && (
          !confirmDelete ? (
            <button type="button" onClick={() => setConfirmDelete(true)} className="w-full py-2.5 rounded-xl border border-rose-200 text-rose-700 text-sm font-semibold flex items-center justify-center gap-1.5">
              <Trash2 size={14} /> Remove {tech.name} from the salon
            </button>
          ) : (
            <div className="p-3.5 rounded-2xl bg-rose-50 border-2 border-rose-300 space-y-2.5">
              <p className="text-sm text-rose-900">
                Remove <strong>{tech.name}</strong> from Turns and Tips? Their Zelle/Venmo info and picture are deleted. Past turn history stays.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={remove} disabled={busy} className="flex-1 py-2.5 bg-rose-600 text-white font-bold text-sm rounded-xl">
                  Yes, remove {tech.name}
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold text-sm rounded-xl">
                  Cancel
                </button>
              </div>
            </div>
          )
        )}

        {picture && <AvatarEditor name={name.trim()} onClose={() => setPicture(false)} />}
      </form>
    </div>
  );
}

function PaymentBox({ label, color, bg, placeholder, value, onChange, qr, loading, onQr, onError, inputClass }) {
  const fileRef = useRef(null);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState(null); // "cleaned" | "notfound" | "original"
  const [original, setOriginal] = useState(null); // the uploaded picture, to go back to it

  // Uploaded screenshot -> find the QR inside -> clean QR (falls back to the picture itself)
  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setWorking(true);
    setStatus(null);
    try {
      const picture = await qrFileToDataUrl(file);
      setOriginal(picture);
      const clean = await cleanQr(picture).catch(() => null);
      if (clean) {
        onQr(clean.dataUrl);
        setStatus("cleaned");
      } else {
        onQr(picture);
        setStatus("notfound");
      }
    } catch (err) {
      onError(err.message);
    } finally {
      setWorking(false);
    }
  }

  // Clean up a picture that is already saved (e.g. the screenshots copied from the old tip page)
  async function cleanSaved() {
    setWorking(true);
    try {
      const clean = await cleanQr(qr);
      if (clean) {
        setOriginal(qr);
        onQr(clean.dataUrl);
        setStatus("cleaned");
      } else setStatus("notfound");
    } catch {
      setStatus("notfound");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="rounded-2xl p-3.5 border border-dashed space-y-2.5" style={{ borderColor: color, background: bg }}>
      <div className="text-sm font-bold" style={{ color }}>{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass + " bg-white"} />
      <div className="flex items-center gap-3">
        <div className="w-24 h-24 shrink-0 rounded-xl bg-white border flex items-center justify-center overflow-hidden" style={{ borderColor: color }}>
          {loading || working ? (
            <Loader2 size={18} className="animate-spin" style={{ color }} />
          ) : qr ? (
            <img src={qr} alt={`${label} QR`} className="w-full h-full object-contain" />
          ) : (
            <QrCode size={26} className="opacity-25" />
          )}
        </div>
        <div className="flex flex-col items-start gap-1.5 min-w-0">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={working} className="px-3 py-2 rounded-xl bg-white border text-xs font-bold flex items-center gap-1.5" style={{ borderColor: color, color }}>
            <Upload size={13} /> {qr ? "Change QR picture" : "Upload QR picture"}
          </button>
          {qr && status !== "cleaned" && !working && (
            <button type="button" onClick={cleanSaved} className="px-3 py-1.5 rounded-xl bg-white/70 text-xs font-bold flex items-center gap-1.5" style={{ color }}>
              <Sparkles size={13} /> Clean up QR
            </button>
          )}
          {qr && !working && (
            <button type="button" onClick={() => { onQr(""); setStatus(null); }} className="px-3 py-1 text-xs font-semibold text-rose-700">
              Remove QR
            </button>
          )}
        </div>
      </div>

      {status === "cleaned" && (
        <p className="text-xs text-emerald-800 flex items-start gap-1.5">
          <Check size={14} className="shrink-0 mt-px" />
          <span>
            QR found and cleaned. It opens the same account.{" "}
            {original && <button type="button" onClick={() => { onQr(original); setStatus("original"); }} className="underline">Use the original picture</button>}
          </span>
        </p>
      )}
      {status === "notfound" && (
        <p className="text-xs text-amber-800">
          Couldn't read a QR code in this picture, so it is kept as is. Try a sharper screenshot, or crop it to the QR in Photos first.
        </p>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </div>
  );
}
