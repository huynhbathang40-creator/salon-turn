import { useEffect, useMemo, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Search } from "lucide-react";
import Avatar from "./Avatar.jsx";
import { getClient } from "./db.js";
import { sortByName } from "./staff.js";
import { ReviewModal, sendLowAlert, LOW, DEFAULT_GOOGLE_REVIEW_URL } from "./Reviews.jsx";

// The page a customer opens on their own phone by scanning the "Rate on your phone" QR on the salon iPad.
// URL: .../salon-turn/?rate=<today's code>. It reads the staff list (public) and sends one review
// through submit_phone_review, which only accepts today's code. Nothing else of the app is reachable from here.

export default function PhoneRate({ code }) {
  const [board, setBoard] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [picked, setPicked] = useState(null);
  const [state, setState] = useState("idle"); // idle | sending | done | error
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  // hide the code from the address bar right away (the page keeps it in memory)
  useEffect(() => {
    try { history.replaceState(null, "", window.location.pathname.replace(/[^/]*$/, "") || "/"); } catch { /* ignore */ }
  }, []);

  // after sending: leave this page for the salon's Google review page, so the link isn't left open on the phone
  const [leaveIn, setLeaveIn] = useState(5);
  useEffect(() => {
    if (state !== "done") return;
    if (leaveIn <= 0) {
      window.location.replace(board?.reviewSettings?.googleUrl || DEFAULT_GOOGLE_REVIEW_URL);
      return;
    }
    const t = setTimeout(() => setLeaveIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [state, leaveIn, board]);

  useEffect(() => {
    let alive = true;
    getClient()
      .then((sb) => sb.from("board").select("data").eq("id", "main").single())
      .then(({ data, error: e }) => {
        if (!alive) return;
        if (e || !data) return setLoadError("Couldn't load the salon. Check your internet and scan again.");
        setBoard(data.data || {});
      })
      .catch(() => alive && setLoadError("Couldn't load the salon. Check your internet and scan again."));
    return () => { alive = false; };
  }, []);

  const expired = board && (board.reviewCode?.code !== code || board.reviewCode?.date !== board.businessDate);

  // whoever served a customer most recently today comes first
  const people = useMemo(() => {
    if (!board) return [];
    const served = {};
    for (const h of board.history || []) if (!served[h.techId] || h.timestamp > served[h.techId]) served[h.techId] = h.timestamp;
    return sortByName(board.technicians || [])
      .map((t) => ({ tech: t, servedAt: served[t.id] || null }))
      .sort((a, b) => (b.servedAt || "").localeCompare(a.servedAt || ""));
  }, [board]);
  const q = query.trim().toLowerCase();
  const visible = people.filter((p) => !q || p.tech.name.toLowerCase().includes(q));

  async function send(tech, r) {
    setPicked(null);
    setState("sending");
    setError("");
    try {
      const sb = await getClient();
      const { error: e } = await sb.rpc("submit_phone_review", {
        p_code: code, p_tech_id: tech.id, p_stars: r.stars, p_tags: r.tags, p_comment: r.comment || "",
      });
      if (e) throw new Error(e.message);
      if (r.stars <= LOW) sendLowAlert(board?.reviewSettings?.ntfyTopic, { techName: tech.name, stars: r.stars, tags: r.tags, comment: r.comment, at: new Date().toISOString() });
      try { localStorage.setItem("salon-turn-rated", String(Date.now())); } catch { /* ignore */ }
      setState("done");
    } catch (err) {
      setError(err.message || "Couldn't send. Check your internet and try again.");
      setState("error");
    }
  }

  const base = import.meta.env.BASE_URL;
  const name = board?.salonPay?.name || "";

  return (
    <div className="min-h-[100dvh] bg-brand-cream text-brand-charcoal pt-safe pb-safe">
      <div className="max-w-xl mx-auto px-4 py-6">
        <div className="flex flex-col items-center text-center">
          <img src={`${base}salon-logo.svg`} alt="" className="logo-light h-16 w-auto" />
          <img src={`${base}salon-logo-dark.svg`} alt="" className="logo-dark h-16 w-auto" />
          {name && <div className="salon-name font-serif font-bold uppercase text-2xl tracking-[0.08em] mt-2">{name}</div>}
        </div>

        {!board && !loadError && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-brand-gold" /></div>}
        {loadError && <Notice icon={AlertCircle} tone="bad" title="Something went wrong" text={loadError} />}
        {board && expired && state !== "done" && (
          <Notice icon={AlertCircle} tone="bad" title="This QR code has expired" text="Please scan the code on the salon iPad again. Thank you!" />
        )}

        {state === "done" && (
          <>
            <Notice icon={CheckCircle2} tone="good" title="Thank you for your review!" text="Your feedback goes straight to the salon. We hope to see you again soon." />
            <p className="text-center text-sm text-brand-softSlate mt-4">Taking you to our Google page in {Math.max(leaveIn, 0)}s…</p>
          </>
        )}

        {board && !expired && state !== "done" && (
          <>
            <h1 className="font-serif text-3xl font-bold text-center mt-6">Who took care of you today?</h1>
            <p className="text-sm text-brand-softSlate text-center mt-1">Tap your technician to rate your service</p>

            {state === "sending" && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-brand-gold" /></div>}
            {state === "error" && <p className="mt-4 text-sm text-rose-700 text-center flex items-center justify-center gap-1.5"><AlertCircle size={16} /> {error}</p>}

            {people.length > 6 && (
              <div className="relative mt-5">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-softSlate" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search technician..."
                  className="w-full bg-white border border-brand-borderLight rounded-full pl-11 pr-4 py-3 text-base focus:outline-none focus:border-brand-gold" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mt-4">
              {visible.map(({ tech, servedAt }) => (
                <button
                  key={tech.id}
                  disabled={state === "sending"}
                  onClick={() => setPicked(tech)}
                  className={`relative bg-white rounded-2xl border shadow-sm p-4 pt-9 flex flex-col items-center gap-2 active:scale-[0.98] transition ${servedAt ? "border-2 border-brand-gold shadow-md" : "border-brand-borderLight"}`}
                >
                  {servedAt && (
                    <span className="absolute top-2 left-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Today · {new Date(servedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </span>
                  )}
                  <Avatar name={tech.name} size={84} />
                  <span className="font-serif font-bold text-xl leading-tight text-center break-words w-full">{tech.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {picked && <ReviewModal tech={picked} hasTip={false} onClose={() => setPicked(null)} onDone={(r) => (r ? send(picked, r) : setPicked(null))} />}
    </div>
  );
}

function Notice({ icon: Icon, tone, title, text }) {
  const good = tone === "good";
  return (
    <div className={`mt-8 rounded-3xl border-2 p-6 text-center ${good ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
      <Icon size={36} className={`mx-auto ${good ? "text-emerald-600" : "text-rose-600"}`} />
      <div className={`font-serif text-2xl font-bold mt-2 ${good ? "text-emerald-900" : "text-rose-900"}`}>{title}</div>
      <p className={`text-sm mt-1 ${good ? "text-emerald-800" : "text-rose-800"}`}>{text}</p>
    </div>
  );
}
