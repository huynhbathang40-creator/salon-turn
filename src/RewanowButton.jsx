import { useEffect, useRef, useState } from "react";
import { CalendarClock, Smartphone, Globe, ChevronDown } from "lucide-react";

// Rewanow has no public link that opens its iPhone app directly, so the app is opened through an
// iPhone Shortcut named exactly "Rewanow" (Shortcuts app -> + -> Open App -> Rewanow).
export const REWANOW_SHORTCUT = "Rewanow";
const SHORTCUT_URL = `shortcuts://run-shortcut?name=${encodeURIComponent(REWANOW_SHORTCUT)}`;
const WEB_URL = "https://www.rewanow.com/apps/";

export default function RewanowButton() {
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const ref = useRef(null);

  // Navigate first, close the menu afterwards (removing the link mid-tap made iPhone ignore it).
  // If the app is still on screen 2.5s later, the Shortcut did not run: show how to fix it.
  function openApp(e) {
    e.preventDefault();
    setHelp(false);
    window.location.href = SHORTCUT_URL;
    const started = Date.now();
    window.setTimeout(() => {
      setOpen(false);
      if (document.visibilityState === "visible" && Date.now() - started < 4000) setHelp(true);
    }, 2500);
  }

  useEffect(() => {
    if (!open) return;
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 pl-3 pr-2 py-2 rounded-xl bg-brand-charcoal text-white text-xs font-bold shadow-sm active:scale-95"
        aria-expanded={open}
      >
        <CalendarClock size={15} className="text-brand-gold" />
        <span className="hidden min-[400px]:inline">Rewanow</span>
        <ChevronDown size={14} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-brand-borderLight shadow-xl p-1.5 z-50 toast-in">
          <a
            href={SHORTCUT_URL}
            onClick={openApp}
            className="flex items-start gap-3 p-3 rounded-xl hover:bg-brand-warmIvory"
          >
            <Smartphone size={18} className="text-brand-gold mt-0.5 shrink-0" />
            <span>
              <span className="block text-sm font-bold text-brand-charcoal">Open Rewanow app</span>
              <span className="block text-[11px] text-brand-softSlate">Uses the iPhone Shortcut "{REWANOW_SHORTCUT}"</span>
            </span>
          </a>
          <a
            href={WEB_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => window.setTimeout(() => setOpen(false), 300)}
            className="flex items-start gap-3 p-3 rounded-xl hover:bg-brand-warmIvory"
          >
            <Globe size={18} className="text-brand-gold mt-0.5 shrink-0" />
            <span>
              <span className="block text-sm font-bold text-brand-charcoal">Open Rewanow website</span>
              <span className="block text-[11px] text-brand-softSlate">rewanow.com in Safari</span>
            </span>
          </a>
        </div>
      )}
      {help && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border-2 border-amber-300 shadow-xl p-4 z-50 text-xs text-brand-charcoal space-y-2 toast-in">
          <p className="font-bold text-sm">Rewanow did not open</p>
          <ol className="list-decimal pl-4 space-y-1 text-brand-softSlate">
            <li>In the Shortcuts app, the shortcut must be named exactly <b className="text-brand-charcoal">{REWANOW_SHORTCUT}</b>.</li>
            <li>Tap it once there: if Rewanow opens, the shortcut works.</li>
            <li>If iPhone asks to allow the shortcut, tap Allow.</li>
          </ol>
          <button onClick={() => setHelp(false)} className="w-full py-2 rounded-xl bg-brand-warmIvory border border-brand-borderLight font-bold">OK</button>
        </div>
      )}
    </div>
  );
}
