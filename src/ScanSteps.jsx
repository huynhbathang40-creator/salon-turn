// Short "how to pay" steps under the QR code (all modes)
const STEPS = {
  zelle: {
    color: "#7414ca",
    bg: "#faf5ff",
    title: "How to pay with Zelle",
    steps: [
      "Open your bank app.",
      "Tap Zelle®, then “Send” (or “Pay with Zelle”).",
      "Tap the QR code icon and scan the code above.",
    ],
  },
  venmo: {
    color: "#008CFF",
    bg: "#f0f8ff",
    title: "How to pay with Venmo",
    steps: [
      "Open the Venmo app.",
      "Tap “Scan” (or Pay / Request, then the QR code icon).",
      "Scan the code above.",
    ],
  },
};

export default function ScanSteps({ method }) {
  const s = STEPS[method] || STEPS.zelle;
  return (
    <div className="mt-5 w-full rounded-2xl p-4 border" style={{ background: s.bg, borderColor: s.color + "40" }}>
      <div className="text-sm font-bold mb-2.5" style={{ color: s.color }}>{s.title}</div>
      <ol className="space-y-2">
        {s.steps.map((t, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-brand-charcoal">
            <span className="w-6 h-6 shrink-0 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ background: s.color }}>{i + 1}</span>
            <span className="pt-0.5">{t}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
