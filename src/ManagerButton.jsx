import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Lock, Unlock, X, Delete, Loader2, ShieldCheck, Gem, Crown } from "lucide-react";
import { useManager, login, setupPin, logout, LOCK_ENABLED } from "./auth.js";
import { hasCloud } from "./db.js";
import { useShowCalls } from "./phones.js";
import { useOwner, ownerUnlock, ownerSetup, exitOwner } from "./owner.js";

const PIN_LENGTH = 6;

// Header chip: "View only" (tap to enter PIN) or "Manager" (tap to lock this device)
export default function ManagerButton({ onMessage }) {
  const { isManager } = useManager();
  const [showCalls, setShowCalls] = useShowCalls();
  const [openPin, setOpenPin] = useState(false); // false | "manager" | "owner"
  const { isOwner } = useOwner();
  const [menu, setMenu] = useState(false);
  if (!hasCloud || !LOCK_ENABLED) return null;

  return (
    <div className="relative">
      <button
        onClick={() => (isManager ? setMenu((v) => !v) : setOpenPin("manager"))}
        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold border ${
          isOwner ? "bg-brand-lightGold border-brand-borderGold text-brand-gold" : isManager ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-white border-brand-borderLight text-brand-softSlate"
        }`}
        aria-label={isManager ? "Manager mode on" : "View only, tap to enter PIN"}
      >
        {isOwner ? <Crown size={14} /> : isManager ? <Unlock size={14} /> : <Lock size={14} />}
        <span className="hidden min-[420px]:inline">{isOwner ? "Owner" : isManager ? "Manager" : "View only"}</span>
      </button>

      {menu && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-brand-borderLight shadow-xl p-3 z-50 toast-in">
          <p className="text-xs text-brand-softSlate px-1 pb-2">This device can change turns, technicians and tips.</p>
          <label className="flex items-center justify-between gap-3 px-1 py-2.5 mb-2 border-y border-brand-borderLight cursor-pointer">
            <span className="text-sm font-semibold text-brand-charcoal">
              📞 Call buttons on this device
              <span className="block text-[11px] font-normal text-brand-softSlate">Turn on for your own iPhone, iPad or Mac</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={showCalls}
              onClick={() => setShowCalls(!showCalls)}
              className={`relative w-12 h-7 shrink-0 rounded-full transition ${showCalls ? "bg-emerald-500" : "bg-slate-300"}`}
            >
              <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${showCalls ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </label>
          {/* owner mode: +1 / under-$30 tools, separate password */}
          {isOwner ? (
            <button
              onClick={() => { setMenu(false); exitOwner(); onMessage?.("Owner mode off. +1 tools hidden on this device."); }}
              className="w-full mb-2 py-2.5 rounded-xl bg-brand-lightGold border border-brand-borderGold text-brand-gold text-sm font-bold flex items-center justify-center gap-1.5"
            >
              <Crown size={14} /> Exit owner mode
            </button>
          ) : (
            <button
              onClick={() => { setMenu(false); setOpenPin("owner"); }}
              className="w-full mb-2 py-2.5 rounded-xl border border-brand-borderGold text-brand-gold text-sm font-bold flex items-center justify-center gap-1.5"
            >
              <Crown size={14} /> Owner mode (+1 tools)
            </button>
          )}
          <button
            onClick={async () => { setMenu(false); exitOwner(); await logout(); onMessage?.("This device is now view only."); }}
            className="w-full py-2.5 rounded-xl bg-brand-charcoal text-white text-sm font-bold flex items-center justify-center gap-1.5"
          >
            <Lock size={14} /> Lock this device
          </button>
        </div>
      )}

      {/* Rendered on <body>: inside the blurred header a full-screen layer would be squeezed into the header */}
      {openPin &&
        createPortal(
          <PinScreen
            mode={openPin}
            onClose={() => setOpenPin(false)}
            onDone={() => {
              onMessage?.(openPin === "owner" ? "Owner mode on: +1 tools are visible on this device." : "Manager mode on for this device.");
              setOpenPin(false);
            }}
          />,
          document.body
        )}
    </div>
  );
}

/* ---------- full-screen PIN pad, like the iPhone lock screen ---------- */

function PinScreen({ mode = "manager", onClose, onDone }) {
  const owner = mode === "owner";
  const { status: managerStatus } = useManager();
  const { status: ownerStatus } = useOwner();
  const setup = (owner ? ownerStatus : managerStatus) === "setup";
  // setup: "code" -> "new" -> "confirm";  normal: "pin"
  const [step, setStep] = useState(setup ? "code" : "pin");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(0);

  useEffect(() => { if (!setup && step === "code") setStep("pin"); }, [setup, step]);

  // stop the page behind from scrolling
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  function fail(msg) {
    setError(msg);
    setPin("");
    setShake((n) => n + 1);
    navigator.vibrate?.([40, 40, 40]);
  }

  async function complete(value) {
    if (step === "new") {
      setFirstPin(value);
      setPin("");
      setError("");
      setStep("confirm");
      return;
    }
    if (step === "confirm" && value !== firstPin) {
      setFirstPin("");
      setStep("new");
      return fail("PINs didn't match. Choose your PIN again.");
    }
    setBusy(true);
    try {
      if (owner) {
        if (step === "confirm") await ownerSetup(code, value);
        else await ownerUnlock(value);
      } else if (step === "confirm") await setupPin(code, value);
      else await login(value);
      navigator.vibrate?.(20);
      onDone();
    } catch (err) {
      if (step === "confirm" && /setup code/i.test(err.message)) {
        setStep("code");
        setFirstPin("");
      }
      fail(err.message);
    } finally {
      setBusy(false);
    }
  }

  function press(d) {
    if (busy || pin.length >= PIN_LENGTH) return;
    setError("");
    const next = pin + d;
    setPin(next);
    if (next.length === PIN_LENGTH) setTimeout(() => complete(next), 120);
  }

  // keyboard support (iPad with keyboard / computer)
  useEffect(() => {
    if (step === "code") return;
    const onKey = (e) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const titles = owner
    ? {
        pin: ["Enter owner PIN", "Shows the +1 (under $30) tools on this device"],
        code: ["Owner setup", "Enter the one-time owner setup code"],
        new: ["Choose a 6-digit owner PIN", "Use a different PIN from the manager PIN"],
        confirm: ["Enter the owner PIN again", "To make sure there's no typo"],
      }
    : {
        pin: ["Enter manager PIN", "Unlock to change turns, technicians and tips"],
        code: ["First-time setup", "Enter the one-time setup code"],
        new: ["Choose a 6-digit PIN", "You'll use it to unlock each phone or iPad"],
        confirm: ["Enter the PIN again", "To make sure there's no typo"],
      };
  const [title, subtitle] = titles[step];

  return (
    <div className="fixed inset-0 z-[100] bg-brand-charcoal text-white flex flex-col pin-in" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex items-center justify-between px-5 pt-safe-4">
        <span className="flex items-center gap-2 text-brand-gold text-xs font-bold uppercase tracking-[0.2em]">
          {owner ? <><Crown size={14} /> Owner</> : <><Gem size={14} /> Manager</>}
        </span>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" aria-label="Close">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-safe-6">
        <ShieldCheck size={36} className="text-brand-gold mb-3" strokeWidth={1.6} />
        <h2 className="font-serif text-2xl font-bold text-center">{title}</h2>
        <p className="text-sm text-white/60 text-center mt-1 max-w-xs">{subtitle}</p>

        {step === "code" ? (
          <form
            className="w-full max-w-xs mt-8 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.replace(/[^A-Z0-9]/g, "").length < 8) return fail("Enter the full setup code (8 characters).");
              setError("");
              setStep("new");
            }}
          >
            <input
              value={code}
              onChange={(e) => {
                const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
                setCode(raw.length > 4 ? raw.slice(0, 4) + "-" + raw.slice(4) : raw);
                setError("");
              }}
              placeholder="XXXX-XXXX"
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-4 text-2xl font-bold tracking-[0.25em] text-center placeholder:text-white/25 focus:outline-none focus:border-brand-gold"
            />
            <button type="submit" className="w-full py-4 rounded-2xl bg-brand-gold text-white font-bold text-base active:scale-[0.98]">
              Continue
            </button>
            {error && <p className="text-sm text-rose-300 text-center">{error}</p>}
          </form>
        ) : (
          <>
            {/* dots */}
            <div key={shake} className={`flex gap-4 mt-8 mb-3 ${shake ? "pin-shake" : ""}`} aria-label={`${pin.length} of ${PIN_LENGTH} digits`}>
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <span
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full border-2 transition ${i < pin.length ? "bg-brand-gold border-brand-gold scale-110" : "border-white/50"}`}
                />
              ))}
            </div>
            <div className="h-6 text-sm text-center">
              {busy ? (
                <Loader2 size={18} className="animate-spin text-brand-gold inline" />
              ) : error ? (
                <span className="text-rose-300">{error}</span>
              ) : null}
            </div>

            {/* keypad */}
            <div className="grid grid-cols-3 gap-x-6 gap-y-4 mt-4">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <Key key={d} onPress={() => press(d)}>{d}</Key>
              ))}
              <span />
              <Key onPress={() => press("0")}>0</Key>
              <button
                onClick={() => setPin((p) => p.slice(0, -1))}
                className="w-[76px] h-[76px] rounded-full flex items-center justify-center text-white/80 active:bg-white/10"
                aria-label="Delete"
              >
                <Delete size={26} />
              </button>
            </div>

            {step === "confirm" && (
              <button onClick={() => { setStep("new"); setPin(""); setFirstPin(""); }} className="mt-6 text-sm text-white/60 underline">
                Start over
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Key({ children, onPress }) {
  return (
    <button
      onClick={onPress}
      className="w-[76px] h-[76px] rounded-full bg-white/10 text-3xl font-light flex items-center justify-center active:bg-brand-gold active:scale-95 transition"
    >
      {children}
    </button>
  );
}
