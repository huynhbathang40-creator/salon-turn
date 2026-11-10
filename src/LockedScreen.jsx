import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Lock, Heart } from "lucide-react";
import { PinScreen } from "./ManagerButton.jsx";

const isGuestPhone = () => { try { return localStorage.getItem("salon-turn-guest") === "1"; } catch { return false; } };

// Shown on any device that hasn't entered the manager PIN: nothing of the salon is visible until it does.
// A customer's phone (it opened the review page before) only gets a thank-you page, with no PIN button at all.
// Staff can still unlock such a phone by tapping the logo 7 times.
export default function LockedScreen({ name }) {
  const [pin, setPin] = useState(false);
  const [guest] = useState(isGuestPhone);
  const taps = useRef({ n: 0, t: 0 });
  const base = import.meta.env.BASE_URL;

  function tapLogo() {
    const now = Date.now();
    taps.current = { n: now - taps.current.t < 1500 ? taps.current.n + 1 : 1, t: now };
    if (taps.current.n >= 7) { taps.current.n = 0; setPin(true); }
  }

  return (
    <div className="min-h-[100dvh] bg-brand-cream text-brand-charcoal flex flex-col items-center justify-center px-6 text-center pt-safe pb-safe">
      <button onClick={tapLogo} className="select-none" aria-label="Salon logo" tabIndex={-1}>
        <img src={`${base}salon-logo.svg`} alt="" draggable="false" className="logo-light h-20 w-auto" />
        <img src={`${base}salon-logo-dark.svg`} alt="" draggable="false" className="logo-dark h-20 w-auto" />
      </button>
      {name && <div className="salon-name font-serif font-bold uppercase text-2xl tracking-[0.08em] mt-3">{name}</div>}

      {guest ? (
        <>
          <Heart size={30} className="text-brand-gold fill-current mt-8" />
          <h1 className="font-serif text-3xl font-bold mt-3">Thank you for coming!</h1>
          <p className="text-sm text-brand-softSlate mt-1 max-w-xs">We hope to see you again soon.</p>
        </>
      ) : (
        <>
          <div className="mt-8 w-14 h-14 rounded-full bg-white border border-brand-borderLight flex items-center justify-center shadow-sm">
            <Lock size={22} className="text-brand-softSlate" />
          </div>
          <h1 className="font-serif text-2xl font-bold mt-3">Staff only</h1>
          <p className="text-sm text-brand-softSlate mt-1 max-w-xs">Enter the manager PIN to open the salon app on this device.</p>
          <button onClick={() => setPin(true)} className="mt-6 px-8 py-3.5 rounded-2xl bg-brand-charcoal text-white font-bold active:scale-[0.98] transition">
            Enter PIN
          </button>
        </>
      )}
      {pin && createPortal(
        <PinScreen
          mode="manager"
          onClose={() => setPin(false)}
          onDone={() => { try { localStorage.removeItem("salon-turn-guest"); } catch { /* ignore */ } setPin(false); }}
        />,
        document.body
      )}
    </div>
  );
}
