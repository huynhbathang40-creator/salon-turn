// Short "how to pay" steps, shown right above the QR code (all modes)
const STEPS = {
  zelle: {
    color: "#7414ca",
    bg: "#faf5ff",
    title: "How to pay with Zelle",
    steps: [
      "Open your bank app.",
      "Tap Zelle®, then “Send” (or “Pay with Zelle”).",
      "Tap the QR code icon and scan the QR code here.",
    ],
  },
  venmo: {
    color: "#008CFF",
    bg: "#f0f8ff",
    title: "How to pay with Venmo",
    steps: [
      "Open the Venmo app.",
      "Tap “Scan” (or Pay / Request, then the QR code icon).",
      "Scan the QR code here.",
    ],
  },
};

export default function ScanSteps({ method }) {
  const s = STEPS[method] || STEPS.zelle;
  return (
    <div className="w-full rounded-2xl p-3 sm:p-4 border text-left" style={{ background: s.bg, borderColor: s.color + "40" }}>
      <div className="text-sm font-bold mb-2" style={{ color: s.color }}>{s.title}</div>
      <ol className="space-y-1.5">
        {s.steps.map((t, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[13px] sm:text-[15px] leading-snug text-brand-charcoal">
            <span className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 rounded-full text-white text-[11px] sm:text-xs font-bold flex items-center justify-center" style={{ background: s.color }}>{i + 1}</span>
            <span className="pt-px">{t}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
