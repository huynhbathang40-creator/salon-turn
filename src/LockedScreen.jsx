import { useState } from "react";
import { createPortal } from "react-dom";
import { Lock } from "lucide-react";
import { PinScreen } from "./ManagerButton.jsx";

// Shown on any device that hasn't entered the manager PIN: nothing of the salon is visible until it does.
export default function LockedScreen({ name }) {
  const [pin, setPin] = useState(false);
  const base = import.meta.env.BASE_URL;
  return (
    <div className="min-h-[100dvh] bg-brand-cream text-brand-charcoal flex flex-col items-center justify-center px-6 text-center pt-safe pb-safe">
      <img src={`${base}salon-logo.svg`} alt="" className="logo-light h-20 w-auto" />
      <img src={`${base}salon-logo-dark.svg`} alt="" className="logo-dark h-20 w-auto" />
      {name && <div className="salon-name font-serif font-bold uppercase text-2xl tracking-[0.08em] mt-3">{name}</div>}
      <div className="mt-8 w-14 h-14 rounded-full bg-white border border-brand-borderLight flex items-center justify-center shadow-sm">
        <Lock size={22} className="text-brand-softSlate" />
      </div>
      <h1 className="font-serif text-2xl font-bold mt-3">Staff only</h1>
      <p className="text-sm text-brand-softSlate mt-1 max-w-xs">Enter the manager PIN to open the salon app on this device.</p>
      <button onClick={() => setPin(true)} className="mt-6 px-8 py-3.5 rounded-2xl bg-brand-charcoal text-white font-bold active:scale-[0.98] transition">
        Enter PIN
      </button>
      {pin && createPortal(<PinScreen mode="manager" onClose={() => setPin(false)} onDone={() => setPin(false)} />, document.body)}
    </div>
  );
}
