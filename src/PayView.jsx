import { useEffect, useState } from "react";
import { Copy, Check, Loader2, Pencil, Store, X, AlertCircle } from "lucide-react";

// Salon payment page: customers pay the service (sale) straight to the owner's Zelle.
// The owner only types a name + phone/email; the Zelle QR is made here, nothing is uploaded.

const ZELLE = "#7414ca";

// "(561) 555-1234" -> "5615551234"; emails are kept (lowercase)
export function cleanZelle(value) {
  const v = (value || "").trim();
  if (v.includes("@")) return v.toLowerCase();
  let d = v.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d;
}

export function zelleError(value) {
  const v = cleanZelle(value);
  if (!v) return "Enter the Zelle phone number or email.";
  if (v.includes("@")) return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? "" : "This email doesn't look right.";
  return v.length === 10 ? "" : "Phone number must have 10 digits.";
}

const showZelle = (v) => (/^\d{10}$/.test(v) ? `(${v.slice(0, 3)}) ${v.slice(3, 6)}-${v.slice(6)}` : v);

// Same format the banks use for their Zelle QR codes
function zelleLink(name, token) {
  const json = JSON.stringify({ name: name.trim().toUpperCase(), token, action: "payment" });
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return "https://enroll.zellepay.com/qr-codes?data=" + btoa(bin);
}

function useZelleQr(name, token) {
  const [img, setImg] = useState(null);
  useEffect(() => {
    if (!name || !token) return setImg(null);
    let alive = true;
    import("qrcode").then(({ default: QRCode }) =>
      QRCode.toDataURL(zelleLink(name, token), { errorCorrectionLevel: "M", margin: 2, width: 720, color: { dark: "#000000", light: "#ffffff" } })
    ).then((url) => alive && setImg(url)).catch((e) => console.error(e));
    return () => { alive = false; };
  }, [name, token]);
  return img;
}

export default function PayView({ pay, isOwner, onSave }) {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const ready = Boolean(pay?.name && pay?.zelle);
  const qr = useZelleQr(pay?.name, pay?.zelle);

  function copy() {
    navigator.clipboard?.writeText(pay.zelle).then(() => {
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

      {!ready ? (
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
          <div className="font-bold text-xl text-brand-charcoal text-center">{pay.name}</div>
          <p className="text-xs font-bold tracking-wider mt-4 mb-2" style={{ color: ZELLE }}>SCAN ZELLE QR CODE</p>
          <div className="rounded-2xl p-3 bg-white qr-surface border-2 border-dashed" style={{ borderColor: ZELLE }}>
            {qr ? (
              <img src={qr} alt={`${pay.name} Zelle QR code`} className="w-[min(70vw,280px)] aspect-square object-contain" />
            ) : (
              <div className="w-[min(70vw,280px)] aspect-square flex items-center justify-center"><Loader2 className="animate-spin" style={{ color: ZELLE }} /></div>
            )}
          </div>

          <div className="mt-5 w-full bg-brand-warmIvory rounded-2xl p-4 text-center border border-dashed border-brand-borderLight">
            <div className="text-[11px] uppercase tracking-wider text-brand-softSlate">Zelle phone / email</div>
            <div className="text-lg font-bold text-brand-charcoal break-all mt-0.5">{showZelle(pay.zelle)}</div>
            <button onClick={copy} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-charcoal text-white text-sm font-bold">
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-[11px] text-brand-softSlate text-center mt-4">
            Check that your bank app shows <b>{pay.name.toUpperCase()}</b> before you send.
          </p>
          {isOwner && (
            <button onClick={() => setEditing(true)} className="mt-3 text-xs text-brand-softSlate underline inline-flex items-center gap-1">
              <Pencil size={12} /> Edit salon Zelle
            </button>
          )}
        </div>
      )}

      {editing && <PayEditor pay={pay} onSave={onSave} onClose={() => setEditing(false)} />}
    </div>
  );
}

function PayEditor({ pay, onSave, onClose }) {
  const [name, setName] = useState(pay?.name || "");
  const [zelle, setZelle] = useState(pay?.zelle ? showZelle(pay.zelle) : "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const previewName = name.trim();
  const previewToken = zelleError(zelle) ? "" : cleanZelle(zelle);
  const preview = useZelleQr(previewName, previewToken);

  async function save(e) {
    e.preventDefault();
    if (!name.trim()) return setError("Enter the name customers will see (the name on the Zelle account).");
    const err = zelleError(zelle);
    if (err) return setError(err);
    setSaving(true);
    try {
      await onSave({ name: name.trim(), zelle: cleanZelle(zelle) });
      onClose();
    } catch (e2) {
      setError(e2?.message || "Could not save.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <form
        onSubmit={save}
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 pb-safe max-h-[94vh] overflow-y-auto relative toast-in space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-brand-warmIvory flex items-center justify-center" aria-label="Close">
          <X size={18} />
        </button>
        <h3 className="font-serif text-xl font-bold text-brand-charcoal">Salon Zelle</h3>

        <label className="block">
          <span className="text-xs font-bold text-brand-softSlate uppercase tracking-wider">Name on the Zelle account</span>
          <input value={name} onChange={(e) => { setName(e.target.value); setError(""); }} maxLength={60} placeholder="e.g. Beautiluxe Nails"
            className="mt-1 w-full border border-brand-borderLight rounded-xl px-3.5 py-3 text-base sm:text-sm focus:outline-none focus:border-brand-gold" />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-brand-softSlate uppercase tracking-wider">Zelle phone number or email</span>
          <input value={zelle} onChange={(e) => { setZelle(e.target.value); setError(""); }} inputMode="tel" placeholder="(561) 555-1234"
            className="mt-1 w-full border border-brand-borderLight rounded-xl px-3.5 py-3 text-base sm:text-sm focus:outline-none focus:border-brand-gold" />
        </label>

        {previewName && previewToken && (
          <div className="flex flex-col items-center">
            <p className="text-[11px] font-bold tracking-wider mb-1.5" style={{ color: ZELLE }}>PREVIEW</p>
            <div className="rounded-xl p-2 bg-white qr-surface border-2 border-dashed" style={{ borderColor: ZELLE }}>
              {preview ? <img src={preview} alt="Zelle QR preview" className="w-40 h-40" /> : <div className="w-40 h-40" />}
            </div>
            <p className="text-[11px] text-brand-softSlate mt-1.5 text-center">Test it once: scan with your own bank app and check it opens the right account.</p>
          </div>
        )}

        {error && <p className="text-sm text-rose-700 flex gap-1.5"><AlertCircle size={16} className="shrink-0 mt-0.5" />{error}</p>}

        <button disabled={saving} className="w-full py-3 rounded-xl bg-brand-charcoal text-white font-bold disabled:opacity-60 flex items-center justify-center gap-2">
          {saving && <Loader2 size={16} className="animate-spin" />} Save
        </button>
      </form>
    </div>
  );
}
