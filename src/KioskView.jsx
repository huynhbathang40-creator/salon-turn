import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Lock, X, Delete, Loader2, ShieldCheck, Store, Heart, Wallet, ChevronLeft, Sparkles, Star, Users, QrCode } from "lucide-react";
import TipsView from "./TipsView.jsx";
import PayView from "./PayView.jsx";
import { Key } from "./ManagerButton.jsx";
import { startKiosk, stopKiosk, checkKioskPin, hasKioskPassword } from "./kiosk.js";
import { login } from "./auth.js";
import { hasCloud } from "./db.js";

const PIN_LENGTH = 6;

/* ---------- the customer screen: welcome -> Tips + Pay ---------- */

const IDLE_SECONDS = 90; // no touch for this long -> back to the welcome screen for the next customer

export default function KioskView({ technicians, salonPay, onTipSent, review }) {
  const [tab, setTab] = useState("welcome"); // welcome | tips | pay
  const [exiting, setExiting] = useState(false);

  function goTab(key) {
    setTab(key);
    history.replaceState(null, "", key === "welcome" ? window.location.pathname + window.location.search : "#" + key);
    window.scrollTo(0, 0);
  }

  // idle: any touch restarts the count; when it runs out, show the welcome screen again
  useEffect(() => {
    if (tab === "welcome" || exiting) return;
    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => goTab("welcome"), IDLE_SECONDS * 1000);
    };
    reset();
    const events = ["pointerdown", "keydown", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true, capture: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset, { capture: true }));
    };
  }, [tab, exiting]);

  const lockButton = (
    <button
      onClick={() => setExiting(true)}
      className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-brand-softSlate/50 active:bg-brand-warmIvory"
      aria-label="Exit customer mode"
    >
      <Lock size={16} />
    </button>
  );

  if (tab === "welcome") {
    return (
      <div className="min-h-[100dvh] bg-brand-cream text-brand-charcoal flex flex-col pt-safe pb-safe">
        <div className="flex justify-end px-4 pt-3">{lockButton}</div>
        <Welcome name={salonPay?.name} hasReview={Boolean(review)} onStart={() => goTab("tips")} onPay={() => goTab("pay")} />
        {exiting && createPortal(<KioskPin mode="exit" onClose={() => setExiting(false)} onDone={() => setExiting(false)} />, document.body)}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-cream text-brand-charcoal flex flex-col">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-brand-borderLight shadow-sm pt-safe">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <button onClick={() => goTab("welcome")} className="flex items-center gap-1.5 text-sm font-bold text-brand-softSlate min-w-0" aria-label="Back to the start">
            <ChevronLeft size={18} className="shrink-0" />
            <span className="font-serif text-xl sm:text-2xl text-brand-charcoal tracking-tight truncate">{salonPay?.name || "Welcome"}</span>
          </button>
          {lockButton}
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-3">
          <div className="flex bg-brand-warmIvory border border-brand-borderLight rounded-2xl p-1 max-w-md mx-auto">
            {[["tips", review ? "Rate & Tip" : "Tip Your Technician", Heart], ["pay", "Pay for Service", Wallet]].map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => goTab(key)}
                className={`flex-1 py-3 rounded-xl text-sm sm:text-base font-bold transition flex items-center justify-center gap-1.5 ${tab === key ? "bg-white text-brand-charcoal shadow-sm" : "text-brand-softSlate"}`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${tab === "pay" ? "py-3" : "py-4"} sm:py-8 w-full flex-grow`}>
        {tab === "pay" ? (
          <PayView pay={salonPay} isOwner={false} simple />
        ) : (
          <TipsView technicians={technicians} canEdit={false} simple onTipSent={onTipSent} review={review} onFinish={() => goTab("welcome")} />
        )}
      </main>

      {exiting && createPortal(<KioskPin mode="exit" onClose={() => setExiting(false)} onDone={() => setExiting(false)} />, document.body)}
    </div>
  );
}

/* ---------- welcome screen (waiting for the next customer) ---------- */

function Welcome({ name, hasReview, onStart, onPay }) {
  const steps = hasReview
    ? [[Users, "Choose your technician"], [Star, "Rate your service"], [Heart, "Leave a tip"]]
    : [[Users, "Choose your technician"], [QrCode, "Scan the QR code"], [Heart, "Leave a tip"]];
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-10 text-center welcome-in">
      {name && <div className="text-xs sm:text-sm font-bold uppercase tracking-[0.25em] text-brand-gold mb-3">{name}</div>}
      <Sparkles size={30} className="text-brand-gold mb-3" strokeWidth={1.5} />
      <h1 className="font-serif font-bold text-4xl sm:text-6xl text-brand-charcoal leading-tight">Thank you<br className="sm:hidden" /> for visiting</h1>
      <p className="text-base sm:text-xl text-brand-softSlate mt-3 max-w-lg">
        {hasReview ? "We'd love to hear about your visit. Rate your technician and leave a tip in a few taps." : "Thank your technician with a tip in a few taps."}
      </p>

      <div className="grid grid-cols-3 gap-2 sm:gap-6 mt-8 w-full max-w-xl">
        {steps.map(([Icon, label], i) => (
          <div key={label} className="flex flex-col items-center gap-2">
            <span className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white border border-brand-borderGold flex items-center justify-center shadow-sm">
              <Icon size={24} className="text-brand-gold" />
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-charcoal text-white text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
            </span>
            <span className="text-xs sm:text-sm font-semibold text-brand-charcoal leading-tight">{label}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onStart}
        className="welcome-cta mt-10 w-full max-w-md py-5 rounded-2xl bg-brand-charcoal text-white text-lg sm:text-xl font-bold flex items-center justify-center gap-2.5 shadow-lg active:scale-[0.98] transition"
      >
        {hasReview ? <><Star size={20} /> Rate &amp; Tip your technician</> : <><Heart size={20} /> Tip your technician</>}
      </button>
      <button onClick={onPay} className="mt-3 w-full max-w-md py-4 rounded-2xl bg-white border border-brand-borderLight text-brand-charcoal text-base font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition">
        <Wallet size={18} /> Pay for your service
      </button>
    </div>
  );
}

/* ---------- password pad: turn on (create / enter password) or turn off ---------- */

// mode: "start" (turn customer mode on) | "exit" (turn it off)
export function KioskPin({ mode, onClose, onDone }) {
  // steps: "new" -> "confirm" (create password), "pin" (enter password), "manager" (forgot: use manager PIN)
  const [step, setStep] = useState(mode === "start" && !hasKioskPassword() ? "new" : "pin");
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(0);

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
    setBusy(true);
    try {
      if (step === "new") {
        setFirstPin(value);
        setPin("");
        setError("");
        setStep("confirm");
      } else if (step === "confirm") {
        if (value !== firstPin) {
          setFirstPin("");
          setStep("new");
          return fail("Passwords didn't match. Choose it again.");
        }
        await startKiosk(value);
        onDone();
      } else if (step === "manager") {
        await login(value); // the manager PIN is checked by the database
        stopKiosk({ forgetPassword: true });
        onDone();
      } else if (await checkKioskPin(value)) {
        if (mode === "start") await startKiosk();
        else stopKiosk();
        navigator.vibrate?.(20);
        onDone();
      } else {
        await new Promise((r) => setTimeout(r, 600));
        fail("Wrong password.");
      }
    } catch (err) {
      fail(err.message || "Something went wrong.");
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

  useEffect(() => {
    const onKey = (e) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const titles = {
    new: ["Create a customer mode password", "6 digits. You'll need it to leave customer mode on this iPad"],
    confirm: ["Enter the password again", "To make sure there's no typo"],
    pin: mode === "start" ? ["Enter customer mode password", "This iPad will only show Tips and Pay"] : ["Enter password to exit", "Staff only"],
    manager: ["Enter the manager PIN", "Exits customer mode and clears its password, so you can make a new one"],
  };
  const [title, subtitle] = titles[step];

  return (
    <div className="fixed inset-0 z-[100] bg-brand-charcoal text-white flex flex-col pin-in" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex items-center justify-between px-5 pt-safe-4">
        <span className="flex items-center gap-2 text-brand-gold text-xs font-bold uppercase tracking-[0.2em]">
          <Store size={14} /> Customer mode
        </span>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" aria-label="Close">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-safe-6">
        <ShieldCheck size={36} className="text-brand-gold mb-3" strokeWidth={1.6} />
        <h2 className="font-serif text-2xl font-bold text-center">{title}</h2>
        <p className="text-sm text-white/60 text-center mt-1 max-w-xs">{subtitle}</p>

        <div key={shake} className={`flex gap-4 mt-8 mb-3 ${shake ? "pin-shake" : ""}`} aria-label={`${pin.length} of ${PIN_LENGTH} digits`}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span key={i} className={`w-3.5 h-3.5 rounded-full border-2 transition ${i < pin.length ? "bg-brand-gold border-brand-gold scale-110" : "border-white/50"}`} />
          ))}
        </div>
        <div className="h-6 text-sm text-center">
          {busy ? <Loader2 size={18} className="animate-spin text-brand-gold inline" /> : error ? <span className="text-rose-300">{error}</span> : null}
        </div>

        <div className="grid grid-cols-3 gap-x-6 gap-y-4 mt-4">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <Key key={d} onPress={() => press(d)}>{d}</Key>
          ))}
          <span />
          <Key onPress={() => press("0")}>0</Key>
          <button onClick={() => setPin((p) => p.slice(0, -1))} className="w-[76px] h-[76px] rounded-full flex items-center justify-center text-white/80 active:bg-white/10" aria-label="Delete">
            <Delete size={26} />
          </button>
        </div>

        <div className="mt-6 flex flex-col items-center gap-2 text-sm text-white/60">
          {step === "confirm" && (
            <button onClick={() => { setStep("new"); setPin(""); setFirstPin(""); }} className="underline">Start over</button>
          )}
          {mode === "start" && step === "pin" && (
            <button onClick={() => { setStep("new"); setPin(""); setError(""); }} className="underline">Change password</button>
          )}
          {mode === "exit" && step === "pin" && hasCloud && (
            <button onClick={() => { setStep("manager"); setPin(""); setError(""); }} className="underline">Forgot password? Use the manager PIN</button>
          )}
        </div>
      </div>
    </div>
  );
}
