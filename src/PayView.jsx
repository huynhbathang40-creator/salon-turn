import { useEffect, useState } from "react";
import { Copy, Check, Loader2, Pencil, Store, X, AlertCircle, QrCode } from "lucide-react";
import { useTipRows, getQr, saveTechTip, SALON_PAY_KEY } from "./tips.js";
import { PaymentBox } from "./TechEditor.jsx";
import { hasCloud } from "./db.js";

// Salon payment page: customers pay the service (sale) straight to the owner's Zelle.
// The QR picture is the one the owner's bank gives; it is uploaded and cleaned like the tip QRs.
// Name + phone live on the shared board; the QR picture is a hidden row in the tip table (loaded only here).

const ZELLE = "#7414ca";

function cleanPhone(value) {
  const v = (value || "").trim();
  if (v.includes("@")) return v.toLowerCase();
  let d = v.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d;
}
const showZelle = (v) => (/^\d{10}$/.test(v || "") ? `(${v.slice(0, 3)}) ${v.slice(3, 6)}-${v.slice(6)}` : v || "");

// the saved QR picture; reloads when another device changes it
function useSalonQr() {
  const { rows, loadError } = useTipRows();
  const [qr, setQr] = useState(undefined); // undefined = loading
  const row = (rows || []).find((r) => r.name_key === SALON_PAY_KEY);
  useEffect(() => {
    if (!rows) return setQr(!hasCloud || loadError ? null : undefined);
    if (!row) return setQr(null);
    let alive = true;
    getQr(SALON_PAY_KEY).then((v) => alive && setQr(v.zelle_qr || null)).catch(() => alive && setQr(null));
    return () => { alive = false; };
  }, [rows, row, loadError]);
  return { qr, row };
}

export default function PayView({ pay, isOwner, onSaveInfo }) {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const { qr, row } = useSalonQr();
  const name = pay?.name || "";
  const zelle = pay?.zelle || row?.zelle || "";
  const loading = qr === undefined;
  const ready = Boolean(qr || zelle);

  function copy() {
    navigator.clipboard?.writeText(zelle).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="space-y-5 max-w-md mx-auto">
      <div className="text-center pt-2">
        <h2 className="font-serif text-3xl font-bold text-brand-charcoal">Pay for Your Service</h2>
        <p className="text-sm text-brand-softSlate mt-1">Scan with your bank app to pay the salon with Zelle</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-brand-gold" /></div>
      ) : !ready ? (
        <div className="bg-white rounded-3xl border border-dashed border-brand-borderLight p-8 text-center">
          <Store size={30} className="text-brand-gold/50 mx-auto mb-2" />
          <p className="text-sm text-brand-softSlate">Salon payment is not set up yet.</p>
          {isOwner ? (
            <button onClick={() => setEditing(true)} className="mt-4 px-5 py-2.5 rounded-full bg-brand-charcoal text-white text-sm font-bold">
              Set up Zelle
            </button>
          ) : (
            <p className="text-[11px] text-brand-softSlate mt-2">The owner can set it up in owner mode.</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-brand-borderLight shadow-sm p-6 flex flex-col items-center">
          {name && <div className="font-bold text-xl text-brand-charcoal text-center mb-4">{name}</div>}
          <p className="text-xs font-bold tracking-wider mb-2" style={{ color: ZELLE }}>{qr ? "SCAN ZELLE QR CODE" : "ZELLE"}</p>
          <div className="rounded-2xl p-3 bg-white qr-surface border-2 border-dashed" style={{ borderColor: ZELLE }}>
            {qr ? (
              <img src={qr} alt="Salon Zelle QR code" className="w-[min(70vw,280px)] aspect-square object-contain" />
            ) : (
              <div className="w-[min(70vw,280px)] aspect-[2/1] flex flex-col items-center justify-center text-brand-softSlate text-xs gap-2">
                <QrCode size={28} className="opacity-30" /> No QR code, use the info below
              </div>
            )}
          </div>

          {zelle && (
            <div className="mt-5 w-full bg-brand-warmIvory rounded-2xl p-4 text-center border border-dashed border-brand-borderLight">
              <div className="text-[11px] uppercase tracking-wider text-brand-softSlate">Zelle phone / email</div>
              <div className="text-lg font-bold text-brand-charcoal break-all mt-0.5">{showZelle(zelle)}</div>
              <button onClick={copy} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-charcoal text-white text-sm font-bold">
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
          <p className="text-[11px] text-brand-softSlate text-center mt-4">Scan with your bank app, or copy the Zelle info.</p>
          {isOwner && (
            <button onClick={() => setEditing(true)} className="mt-3 text-xs text-brand-softSlate underline inline-flex items-center gap-1">
              <Pencil size={12} /> Edit salon Zelle
            </button>
          )}
        </div>
      )}

      {editing && <PayEditor name={name} zelle={zelle} savedQr={qr || null} onSaveInfo={onSaveInfo} onClose={() => setEditing(false)} />}
    </div>
  );
}

function PayEditor({ name: savedName, zelle: savedZelle, savedQr, onSaveInfo, onClose }) {
  const [name, setName] = useState(savedName);
  const [zelle, setZelle] = useState(showZelle(savedZelle));
  const [qr, setQr] = useState(savedQr); // what is shown in the box
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    const z = cleanPhone(zelle);
    if (z && !z.includes("@") && z.length !== 10) return setError("Phone number must have 10 digits.");
    if (!qr && !z) return setError("Upload the QR picture or enter the Zelle phone (at least one).");
    setSaving(true);
    try {
      await saveTechTip({
        oldName: SALON_PAY_KEY,
        name: SALON_PAY_KEY,
        zelle: z,
        zelleQr: qr === savedQr ? undefined : qr || "",
        venmo: "",
      });
      await onSaveInfo({ name: name.trim(), zelle: z });
      onClose();
    } catch (e2) {
      setError(e2?.message || "Could not save. Check the internet connection.");
      setSaving(false);
    }
  }

  const input = "w-full bg-brand-warmIvory border border-brand-borderLight rounded-xl px-3.5 py-2.5 text-base sm:text-sm focus:outline-none focus:border-brand-gold";

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <form
        onSubmit={save}
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 pb-safe max-h-[94vh] overflow-y-auto relative toast-in space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-brand-warmIvory flex items-center justify-center" aria-label="Close">
          <X size={18} />
        </button>
        <h3 className="font-serif text-xl font-bold text-brand-charcoal">Salon Zelle</h3>

        <label className="block">
          <span className="block text-xs font-bold text-brand-softSlate mb-1">Name shown above the QR (optional)</span>
          <input value={name} onChange={(e) => { setName(e.target.value); setError(""); }} maxLength={60} placeholder="e.g. Beautiluxe Nails" className={input} />
        </label>

        <PaymentBox
          label="Zelle"
          color={ZELLE}
          bg="#faf5ff"
          placeholder="Zelle phone or email (optional)"
          value={zelle}
          onChange={(v) => { setZelle(v); setError(""); }}
          qr={qr}
          loading={false}
          onQr={(v) => { setQr(v || null); setError(""); }}
          onError={setError}
          inputClass={input}
        />

        {error && <p className="text-sm text-rose-700 flex gap-1.5"><AlertCircle size={16} className="shrink-0 mt-0.5" />{error}</p>}

        <button disabled={saving} className="w-full py-3 rounded-xl bg-brand-charcoal text-white font-bold disabled:opacity-60 flex items-center justify-center gap-2">
          {saving && <Loader2 size={16} className="animate-spin" />} Save
        </button>
      </form>
    </div>
  );
}
