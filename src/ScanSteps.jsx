// Short "how to pay" steps, shown next to / above the QR code (all modes).
// This one component is used for every technician and the salon Pay page, so the steps are always the same.
// Both Zelle and Venmo steps are always rendered in the same spot (the hidden one is invisible),
// so the box keeps exactly the same height when switching between Zelle and Venmo.
const STEPS = {
  zelle: {
    title: "How to pay with Zelle",
    steps: ["Open your bank app.", "Tap “Pay & Transfer”.", "Tap Zelle®, then “Send”.", "Tap the QR icon and scan this code."],
  },
  venmo: {
    title: "How to pay with Venmo",
    steps: ["Open your phone's Camera (or the Venmo app).", "Point it at this code.", "Tap the Venmo link that pops up and pay."],
  },
};

function StepList({ k, active }) {
  const s = STEPS[k];
  return (
    <div className={`scan-${k} !bg-transparent col-start-1 row-start-1 ${active ? "" : "invisible"}`} aria-hidden={!active}>
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

export default function ScanSteps({ method }) {
  const key = STEPS[method] ? method : "zelle";
  return (
    <div className={`scan-steps scan-${key} w-full rounded-2xl px-3 py-2.5 sm:p-4 border text-left grid`}>
      <StepList k="zelle" active={key === "zelle"} />
      <StepList k="venmo" active={key === "venmo"} />
    </div>
  );
}
