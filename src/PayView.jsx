import { useEffect, useState } from "react";
import { Copy, Check, Loader2, Pencil, Store, X, AlertCircle, QrCode } from "lucide-react";
import { useTipRows, getQr, saveTechTip, SALON_PAY_KEY } from "./tips.js";
import { PaymentBox } from "./TechEditor.jsx";
import { hasCloud } from "./db.js";
import ScanSteps from "./ScanSteps.jsx";

// Salon payment page: customers pay the service (sale) straight to the owner, by Zelle or Venmo.
// The QR pictures are the ones the owner's apps give; they are uploaded and cleaned like the tip QRs.
// Zelle / Venmo info + QR pictures are a hidden row in the tip table (loaded only here); the name lives on the board.

const METHODS = {
  zelle: { label: "Zelle", color: "#7414ca", bg: "#faf5ff", tab: "#f3e8ff", hint: "Scan with your bank app, or copy the Zelle info." },
  venmo: { label: "Venmo", color: "#008CFF", bg: "#f0f8ff", tab: "#e6f4ff", hint: "Scan with the Venmo app, or copy the username." },
};

function cleanZelle(value) {
  const v = (value || "").trim();
  if (v.includes("@")) return v.toLowerCase();
  let d = v.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d;
}
const cleanVenmo = (v) => (v || "").trim().replace(/^@/, "");
const showZelle = (v) => (/^\d{10}$/.test(v || "") ? `(${v.slice(0, 3)}) ${v.slice(3, 6)}-${v.slice(6)}` : v || "");

// the saved info + QR pictures; reloads when another device changes them
function useSalonPay() {
  const { rows, loadError } = useTipRows();
  const [qr, setQr] = useState(undefined); // undefined = loading
  const row = (rows || []).find((r) => r.name_key === SALON_PAY_KEY);
  useEffect(() => {
    if (!rows) return setQr(!hasCloud || loadError ? { zelle_qr: null, venmo_qr: null } : undefined);
    if (!row) return setQr({ zelle_qr: null, venmo_qr: null });
    let alive = true;
    getQr(SALON_PAY_KEY)
      .then((v) => alive && setQr({ zelle_qr: v.zelle_qr || null, venmo_qr: v.venmo_qr || null }))
      .catch(() => alive && setQr({ zelle_qr: null, venmo_qr: null }));
    return () => { alive = false; };
  }, [rows, row, loadError]);
  return { qr, row };
}

// simple = customer mode: shows the "how to pay" steps
export default function PayView({ pay, isOwner, onSaveInfo, simple = false }) {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [picked, setPicked] = useState(null);
  const { qr, row } = useSalonPay();
  const name = pay?.name || "";
  const info = { zelle: row?.zelle || pay?.zelle || "", venmo: row?.venmo || "" };
  const loading = qr === undefined;
  const has = {
    zelle: Boolean(info.zelle || qr?.zelle_qr),
    venmo: Boolean(info.venmo || qr?.venmo_qr),
  };
  const method = picked && has[picked] ? picked : has.zelle ? "zelle" : "venmo";
  const m = METHODS[method];
  const image = method === "zelle" ? qr?.zelle_qr : qr?.venmo_qr;
  const handle = method === "zelle" ? showZelle(info.zelle) : info.venmo ? "@" + info.venmo : "";

  function copy() {
    const text = method === "zelle" ? info.zelle : info.venmo;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="space-y-5 max-w-md mx-auto">
      <div className="text-center pt-2">
        <h2 className="font-serif text-3xl font-bold text-brand-charcoal">Pay for Your Service</h2>
        <p className="text-sm text-brand-softSlate mt-1">Scan to pay the salon with Zelle or Venmo</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-brand-gold" /></div>
      ) : !has.zelle && !has.venmo ? (
        <div className="bg-white rounded-3xl border border-dashed border-brand-borderLight p-8 text-center">
          <Store size={30} className="text-brand-gold/50 mx-auto mb-2" />
          <p className="text-sm text-brand-softSlate">Salon payment is not set up yet.</p>
          {isOwner ? (
            <button onClick={() => setEditing(true)} className="mt-4 px-5 py-2.5 rounded-full bg-brand-charcoal text-white text-sm font-bold">
              Set up Zelle / Venmo
            </button>
          ) : (
            <p className="text-[11px] text-brand-softSlate mt-2">The owner can set it up in owner mode.</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-brand-borderLight shadow-sm p-6 flex flex-col items-center">
          {name && <div className="font-bold text-xl text-brand-charcoal text-center">{name}</div>}

          {has.zelle && has.venmo && (
            <div className="grid grid-cols-2 gap-2 mt-4 w-full">
              {["zelle", "venmo"].map((k) => (
                <button
                  key={k}
                  onClick={() => { setPicked(k); setCopied(false); }}
                  className={`py-2.5 rounded-xl border-2 font-bold text-sm ${method === k ? "pay-tab-active" : ""}`}
                  style={method === k ? { borderColor: METHODS[k].color, color: METHODS[k].color, background: METHODS[k].tab } : { borderColor: "#E8E8EC", color: "#4A4A52" }}
                >
                  {METHODS[k].label}
                </button>
              ))}
            </div>
          )}

          <p className="text-xs font-bold tracking-wider mt-5 mb-2" style={{ color: m.color }}>
            {image ? `SCAN ${m.label.toUpperCase()} QR CODE` : m.label.toUpperCase()}
          </p>
          {image && <div className="w-full mb-3"><ScanSteps method={method} /></div>}
          <div className="rounded-2xl p-3 bg-white qr-surface border-2 border-dashed" style={{ borderColor: m.color }}>
            {image ? (
              <img src={image} alt={`Salon ${m.label} QR code`} className="w-[min(70vw,280px)] aspect-square object-contain" />
            ) : (
              <div className="w-[min(70vw,280px)] aspect-[2/1] flex flex-col items-center justify-center text-brand-softSlate text-xs gap-2">
                <QrCode size={28} className="opacity-30" /> No QR code, use the info below
              </div>
            )}
          </div>

          {handle && (
            <div className="mt-5 w-full bg-brand-warmIvory rounded-2xl p-4 text-center border border-dashed border-brand-borderLight">
              <div className="text-[11px] uppercase tracking-wider text-brand-softSlate">{method === "zelle" ? "Zelle phone / email" : "Venmo username"}</div>
              <div className="text-lg font-bold text-brand-charcoal break-all mt-0.5">{handle}</div>
              <button onClick={copy} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-charcoal text-white text-sm font-bold">
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
          <p className="text-[11px] text-brand-softSlate text-center mt-4">{m.hint}</p>
          {isOwner && (
            <button onClick={() => setEditing(true)} className="mt-3 text-xs text-brand-softSlate underline inline-flex items-center gap-1">
              <Pencil size={12} /> Edit salon Zelle / Venmo
            </button>
          )}
        </div>
      )}

      {editing && <PayEditor name={name} info={info} savedQr={qr || { zelle_qr: null, venmo_qr: null }} onSaveInfo={onSaveInfo} onClose={() => setEditing(false)} />}
    </div>
  );
}

function PayEditor({ name: savedName, info, savedQr, onSaveInfo, onClose }) {
  const [name, setName] = useState(savedName);
  const [zelle, setZelle] = useState(showZelle(info.zelle));
  const [venmo, setVenmo] = useState(info.venmo);
  const [zelleQr, setZelleQr] = useState(savedQr.zelle_qr);
  const [venmoQr, setVenmoQr] = useState(savedQr.venmo_qr);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    const z = cleanZelle(zelle);
    const v = cleanVenmo(venmo);
    if (z && !z.includes("@") && z.length !== 10) return setError("Zelle phone number must have 10 digits.");
    if (!zelleQr && !z && !venmoQr && !v) return setError("Add Zelle or Venmo (a QR picture or the phone / username).");
    setSaving(true);
    try {
      await saveTechTip({
        oldName: SALON_PAY_KEY,
        name: SALON_PAY_KEY,
        zelle: z,
        zelleQr: zelleQr === savedQr.zelle_qr ? undefined : zelleQr || "",
        venmo: v,
        venmoQr: venmoQr === savedQr.venmo_qr ? undefined : venmoQr || "",
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
        <h3 className="font-serif text-xl font-bold text-brand-charcoal">Salon Zelle / Venmo</h3>

        <label className="block">
          <span className="block text-xs font-bold text-brand-softSlate mb-1">Name shown above the QR (optional)</span>
          <input value={name} onChange={(e) => { setName(e.target.value); setError(""); }} maxLength={60} placeholder="e.g. Beautiluxe Nails" className={input} />
        </label>

        <PaymentBox
          label="Zelle"
          color={METHODS.zelle.color}
          bg={METHODS.zelle.bg}
          placeholder="Zelle phone or email (optional)"
          value={zelle}
          onChange={(v) => { setZelle(v); setError(""); }}
          qr={zelleQr}
          loading={false}
          onQr={(v) => { setZelleQr(v || null); setError(""); }}
          onError={setError}
          inputClass={input}
        />

        <PaymentBox
          label="Venmo"
          color={METHODS.venmo.color}
          bg={METHODS.venmo.bg}
          placeholder="Venmo username (optional)"
          value={venmo}
          onChange={(v) => { setVenmo(v); setError(""); }}
          qr={venmoQr}
          loading={false}
          onQr={(v) => { setVenmoQr(v || null); setError(""); }}
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
