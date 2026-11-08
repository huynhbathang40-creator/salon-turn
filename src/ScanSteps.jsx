// Short "how to pay" steps, shown next to / above the QR code (all modes).
// Colors come from classes (scan-zelle / scan-venmo) so dark mode can restyle them in dark.css.
const STEPS = {
  zelle: {
    title: "How to pay with Zelle",
    steps: ["Open your bank app.", "Tap Zelle®, then “Send”.", "Tap the QR icon and scan this code."],
  },
  venmo: {
    title: "How to pay with Venmo",
    steps: ["Open the Venmo app.", "Tap “Scan” (or the QR icon).", "Scan this code."],
  },
};

export default function ScanSteps({ method }) {
  const key = STEPS[method] ? method : "zelle";
  const s = STEPS[key];
  return (
    <div className={`scan-steps scan-${key} w-full rounded-2xl px-3 py-2.5 sm:p-4 border text-left`}>
      <div className="scan-title text-[13px] sm:text-sm font-bold mb-1.5 sm:mb-2">{s.title}</div>
      <ol className="space-y-1 sm:space-y-1.5">
        {s.steps.map((t, i) => (
          <li key={i} className="flex items-center gap-2 sm:gap-2.5 text-[13px] sm:text-[15px] leading-snug">
            <span className="scan-num w-5 h-5 sm:w-6 sm:h-6 shrink-0 rounded-full text-white text-[11px] sm:text-xs font-bold flex items-center justify-center">{i + 1}</span>
            <span className="scan-text">{t}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
