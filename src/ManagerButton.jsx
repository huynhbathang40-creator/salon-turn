import { useEffect, useRef, useState } from "react";
import { Lock, Unlock, X, Loader2, ShieldCheck } from "lucide-react";
import { useManager, login, setupPin, logout, LOCK_ENABLED } from "./auth.js";
import { hasCloud } from "./db.js";

// Header chip: "View only" (tap to enter PIN) or "Manager" (tap to lock this device)
export default function ManagerButton({ onMessage }) {
  const { isManager } = useManager();
  const [openPin, setOpenPin] = useState(false);
  const [menu, setMenu] = useState(false);
  if (!hasCloud || !LOCK_ENABLED) return null;

  return (
    <div className="relative">
      <button
        onClick={() => (isManager ? setMenu((v) => !v) : setOpenPin(true))}
        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold border ${
          isManager ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-white border-brand-borderLight text-brand-softSlate"
        }`}
        aria-label={isManager ? "Manager mode on" : "View only, tap to enter PIN"}
      >
        {isManager ? <Unlock size={14} /> : <Lock size={14} />}
        <span className="hidden min-[420px]:inline">{isManager ? "Manager" : "View only"}</span>
      </button>

      {menu && (
        <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl border border-brand-borderLight shadow-xl p-3 z-50 toast-in">
          <p className="text-xs text-brand-softSlate px-1 pb-2">This device can change turns, tips pictures and settings.</p>
          <button
            onClick={async () => { setMenu(false); await logout(); onMessage?.("This device is now view only."); }}
            className="w-full py-2.5 rounded-xl bg-brand-charcoal text-white text-sm font-bold flex items-center justify-center gap-1.5"
          >
            <Lock size={14} /> Lock this device
          </button>
        </div>
      )}

      {openPin && <PinModal onClose={() => setOpenPin(false)} onDone={() => { setOpenPin(false); onMessage?.("Manager mode on for this device."); }} />}
    </div>
  );
}

function PinModal({ onClose, onDone }) {
  const { status } = useManager();
  const setup = status === "setup";
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const firstRef = useRef(null);

  useEffect(() => { firstRef.current?.focus(); }, [setup]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (setup) {
      if (!/^\d{6,10}$/.test(pin)) return setError("PIN must be 6 to 10 digits.");
      if (pin !== pin2) return setError("The two PINs are different.");
    }
    setBusy(true);
    try {
      if (setup) await setupPin(code, pin);
      else await login(pin);
      onDone();
    } catch (err) {
      setError(err.message);
      setPin("");
      setPin2("");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full bg-brand-warmIvory border border-brand-borderLight rounded-xl px-4 py-3 text-lg tracking-[0.3em] text-center font-bold focus:outline-none focus:border-brand-gold";

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 pb-safe relative toast-in space-y-3"
      >
        <button type="button" onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-brand-warmIvory flex items-center justify-center" aria-label="Close">
          <X size={18} />
        </button>
        <div className="flex flex-col items-center text-center gap-1 pb-1">
          <ShieldCheck size={30} className="text-brand-gold" />
          <h3 className="font-bold text-lg text-brand-charcoal">{setup ? "Set your manager PIN" : "Enter manager PIN"}</h3>
          <p className="text-xs text-brand-softSlate">
            {setup ? "Use the one-time setup code, then choose a 6–10 digit PIN." : "Only devices with the PIN can change the board."}
          </p>
        </div>

        {setup && (
          <input
            ref={firstRef}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Setup code"
            autoCapitalize="characters"
            autoComplete="off"
            className={input + " tracking-[0.15em]"}
          />
        )}
        <input
          ref={setup ? undefined : firstRef}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder={setup ? "New PIN" : "PIN"}
          type="password"
          inputMode="numeric"
          autoComplete={setup ? "new-password" : "current-password"}
          className={input}
        />
        {setup && (
          <input
            value={pin2}
            onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="Repeat new PIN"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            className={input}
          />
        )}

        {error && <p className="text-sm text-rose-700 text-center">{error}</p>}

        <button
          type="submit"
          disabled={busy || !pin || (setup && (!code || !pin2))}
          className="w-full py-3 rounded-xl bg-brand-charcoal text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {busy && <Loader2 size={16} className="animate-spin" />} {setup ? "Save PIN" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
