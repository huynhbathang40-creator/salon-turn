import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Lock, X, Delete, Loader2, ShieldCheck, Store, Heart, Wallet, ChevronLeft, Sparkles, Star, Users, QrCode, ChevronRight, Smartphone } from "lucide-react";
import TipsView from "./TipsView.jsx";
import PayView from "./PayView.jsx";
import { Key } from "./ManagerButton.jsx";
import { startKiosk, stopKiosk, checkKioskPin, hasKioskPassword } from "./kiosk.js";
import { login } from "./auth.js";
import { hasCloud } from "./db.js";

const PIN_LENGTH = 6;

/* ---------- the customer screen: welcome -> Tips + Pay ---------- */

const IDLE_SECONDS = 90; // no touch for this long -> back to the welcome screen for the next customer

export default function KioskView({ technicians, salonPay, onTipSent, review, rateUrl }) {
  const [tab, setTab] = useState("welcome"); // welcome | tips | rate | pay
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
        <Welcome name={salonPay?.name} hasReview={Boolean(review)} rateUrl={rateUrl} onTip={() => goTab("tips")} onRate={() => goTab("rate")} onPay={() => goTab("pay")} />
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
            {(review ? [["tips", "Tip", Heart], ["rate", "Rate", Star], ["pay", "Pay", Wallet]] : [["tips", "Tip Your Technician", Heart], ["pay", "Pay for Service", Wallet]]).map(([key, label, Icon]) => (
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
          <TipsView key={tab} technicians={technicians} canEdit={false} simple onTipSent={onTipSent} review={review} flow={tab === "rate" ? "rate" : "tip"} onFinish={() => goTab("welcome")} />
        )}
      </main>

      {exiting && createPortal(<KioskPin mode="exit" onClose={() => setExiting(false)} onDone={() => setExiting(false)} />, document.body)}
    </div>
  );
}

/* ---------- welcome screen (waiting for the next customer) ---------- */

// "In a hurry?" QR: the customer rates on their own phone (?rate=<today's code>)
function RateOnPhone({ url }) {
  const [qr, setQr] = useState(null);
  useEffect(() => {
    let alive = true;
    import("qrcode")
      .then(({ default: QRCode }) => QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 400 }))
      .then((u) => alive && setQr(u))
      .catch(() => {});
    return () => { alive = false; };
  }, [url]);
  return (
    <div className="rate-phone mt-6 w-full max-w-md rounded-2xl border-2 border-dashed p-3 sm:p-4 flex items-center gap-4 text-left">
      <div className="shrink-0 rounded-xl bg-white p-1.5 qr-surface">
        {qr ? <img src={qr} alt="Rate on your phone QR code" className="w-24 h-24 sm:w-28 sm:h-28" /> : <div className="w-24 h-24 sm:w-28 sm:h-28" />}
      </div>
      <div className="min-w-0">
        <div className="rate-phone-title font-bold text-base sm:text-lg leading-tight flex items-center gap-1.5"><Smartphone size={18} /> In a hurry?</div>
        <div className="rate-phone-text text-sm sm:text-base mt-1">Scan with your phone's Camera to rate your technician on your own phone.</div>
      </div>
    </div>
  );
}

// the salon emblem, traced to a vector (SVG) so it is razor sharp at any size: a deeper gold for light mode, a brighter gold for dark mode
function SalonLogo() {
  const [ok, setOk] = useState(true);
  if (!ok) return <Sparkles size={30} className="text-brand-gold mb-3" strokeWidth={1.5} />;
  const base = import.meta.env.BASE_URL;
  const cls = "h-24 sm:h-36 w-auto object-contain mb-3 sm:mb-4";
  return (
    <>
      <img src={`${base}salon-logo.svg`} alt="" onError={() => setOk(false)} className={`logo-light ${cls}`} />
      <img src={`${base}salon-logo-dark.svg`} alt="" className={`logo-dark ${cls}`} />
    </>
  );
}

// the salon name in the logo's style: first word big serif, the rest small and widely spaced
function SalonName({ name }) {
  const [first, ...rest] = name.trim().split(/\s+/);
  return (
    <div className="salon-name mb-5 sm:mb-6 text-center">
      <div className="font-serif font-bold uppercase text-4xl sm:text-6xl tracking-[0.08em] leading-none">{first}</div>
      {rest.length > 0 && <div className="mt-2 sm:mt-3 text-base sm:text-2xl font-semibold uppercase tracking-[0.45em] pl-[0.45em]">{rest.join(" ")}</div>}
    </div>
  );
}

function Welcome({ name, hasReview, rateUrl, onTip, onRate, onPay }) {
  // iPad landscape (lg): brand on the left, actions on the right, so everything fits without scrolling
  return (
    <div className="flex-1 flex items-center justify-center px-6 pb-10 welcome-in">
      <div className="w-full max-w-xl lg:max-w-6xl flex flex-col items-center text-center lg:grid lg:grid-cols-2 lg:gap-14 lg:items-center">
        <div className="flex flex-col items-center">
          <SalonLogo />
          {name && <SalonName name={name} />}
          <h1 className="font-serif font-bold text-3xl sm:text-5xl text-brand-charcoal leading-tight">Thank you for visiting</h1>
          <p className="text-base sm:text-xl text-brand-softSlate mt-3 max-w-lg">
            {hasReview ? "Tip your technician or tell us about your visit. Each takes just a few taps." : "Thank your technician with a tip in a few taps."}
          </p>
        </div>

        <div className="flex flex-col items-center w-full">
          {/* tip and review are separate: a customer can do just one, or both */}
          <div className={`mt-8 lg:mt-0 w-full max-w-md grid gap-3 ${hasReview ? "grid-cols-2" : "grid-cols-1"}`}>
            <button onClick={onTip} className="welcome-cta py-5 sm:py-7 px-2 rounded-2xl font-extrabold flex flex-col items-center justify-center gap-1.5">
              <span className="welcome-cta-shine" aria-hidden="true" />
              <Heart size={30} className="fill-current" />
              <span className="text-lg sm:text-2xl leading-tight">Leave a tip</span>
              <span className="text-xs sm:text-sm font-semibold opacity-80">Zelle or Venmo</span>
            </button>
            {hasReview && (
              <button onClick={onRate} className="welcome-cta py-5 sm:py-7 px-2 rounded-2xl font-extrabold flex flex-col items-center justify-center gap-1.5">
                <span className="welcome-cta-shine" aria-hidden="true" />
                <Star size={30} className="fill-current" />
                <span className="text-lg sm:text-2xl leading-tight">Rate your visit</span>
              </button>
            )}
          </div>
          <button onClick={onPay} className="mt-3 w-full max-w-md py-4 rounded-2xl bg-white border border-brand-borderLight text-brand-charcoal text-base font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition">
            <Wallet size={18} /> Pay for your service
          </button>

          {rateUrl && <RateOnPhone url={rateUrl} />}
        </div>
      </div>
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
