import { useEffect, useState } from "react";
import {
  Star, X, Check, AlertTriangle, Bell, Loader2, Send, Link2, MessageSquare, Heart,
  Smile, Feather, BadgeCheck, MessageCircle, Ear, Clock, Sparkles, Target, Gem, Droplet, Palette, Leaf,
  BadgeDollarSign, Armchair, Repeat, Timer, Hand, Frown, EarOff, Smartphone, XCircle, Shapes, Bandage,
  Scissors, Hourglass, Trash2, DollarSign, Volume2, Receipt, UserRound, Paintbrush, Building2,
} from "lucide-react";
import Avatar from "./Avatar.jsx";

// Customer reviews ("Rate & Tip").
// A customer picks the technician who served them, rates 1–5 stars (+ quick tags / a short note), then tips.
// Reviews live on the shared board (data.reviews), so they sync to every device; only owner mode shows them.
// A rating of 3 stars or less sends a free push alert through ntfy.sh to everyone subscribed to the salon's topic.

const KEEP = 600; // older reviews are dropped so the board stays small
export const LOW = 3; // this many stars or fewer = low rating (alert)

// BeautiLuxe Nail Spa (9882 Glades Rd, Boca Raton) on Google: this link opens the "write a review" form directly.
// Used until the owner saves another link in Reviews > Settings.
export const DEFAULT_GOOGLE_REVIEW_URL = "https://search.google.com/local/writereview?placeid=ChIJm6ZCcOIb2YgRlyuoNVAGzKE";
const AUTO_CLOSE = 90;

// quick tags, grouped so they are easy to scan and tap
// [group title, group icon, [[tag, icon], ...]]
export const GOOD_GROUPS = [
  ["Your technician", UserRound, [["Friendly", Smile], ["Gentle", Feather], ["Professional", BadgeCheck], ["Great advice", MessageCircle], ["Attentive", Ear], ["Took their time", Clock]]],
  ["Your nails", Paintbrush, [["Beautiful work", Sparkles], ["Exactly what I wanted", Target], ["Perfect shape", Gem], ["Smooth polish", Droplet], ["Creative design", Palette], ["Clean & neat", Check]]],
  ["Your visit", Building2, [["On time", Clock], ["Relaxing", Leaf], ["Clean salon", Sparkles], ["Comfortable", Armchair], ["Great value", BadgeDollarSign], ["Will come back", Repeat]]],
];
export const BAD_GROUPS = [
  ["Your technician", UserRound, [["Too rushed", Timer], ["Not gentle", Hand], ["Not friendly", Frown], ["Didn't listen", EarOff], ["On the phone", Smartphone], ["Not careful", AlertTriangle]]],
  ["Your nails", Paintbrush, [["Not what I wanted", XCircle], ["Polish not neat", Droplet], ["Uneven shape", Shapes], ["Got hurt", Bandage], ["Messy cuticles", Scissors], ["Wrong color", Palette]]],
  ["Your visit", Building2, [["Waited too long", Hourglass], ["Not clean", Trash2], ["Too pricey", DollarSign], ["Too noisy", Volume2], ["Uncomfortable", Armchair], ["Unclear prices", Receipt]]],
];
const STAR_WORDS = ["", "Poor", "Fair", "Okay", "Good", "Excellent"];

/* ---------- data helpers ---------- */

// made once outside the updater, because the store may run the updater more than once
export function newReview(tech, stars, tags, comment, id) {
  return { id, techId: tech.id, techName: tech.name, stars, tags, comment: (comment || "").trim().slice(0, 300), at: new Date().toISOString(), handled: false };
}

export function addReview(board, review) {
  if ((board.reviews || []).some((r) => r.id === review.id)) return board;
  return { ...board, reviews: [...(board.reviews || []), { ...review, date: board.businessDate }].slice(-KEEP) };
}

export const markHandled = (board, id, handled = true) => ({
  ...board,
  reviews: (board.reviews || []).map((r) => (r.id === id ? { ...r, handled } : r)),
});

export const openLowReviews = (board) => (board.reviews || []).filter((r) => r.stars <= LOW && !r.handled);

// a fresh, hard-to-guess ntfy topic name
export const newTopic = () => "salon-turn-" + Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("");

// free push alert (ntfy.sh). Never blocks the customer: errors are only logged.
export async function sendLowAlert(topic, review) {
  if (!topic) return false;
  const time = new Date(review.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const parts = [review.tags?.join(", "), review.comment ? `“${review.comment}”` : "", time].filter(Boolean);
  try {
    const res = await fetch("https://ntfy.sh/", {
      method: "POST",
      body: JSON.stringify({
        topic,
        title: `${review.stars}★ review — ${review.techName}`,
        message: parts.join(" · "),
        priority: review.stars <= 2 ? 5 : 4,
        tags: ["warning"],
      }),
    });
    return res.ok;
  } catch (e) {
    console.warn("ntfy alert failed", e);
    return false;
  }
}

const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function Stars({ value, size = 14 }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} className={n <= value ? "text-amber-400 fill-amber-400" : "text-brand-borderLight"} />
      ))}
    </span>
  );
}

function useAutoClose(onClose, seconds = AUTO_CLOSE) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const t = setInterval(() => setLeft((n) => n - 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left <= 0) onClose();
  }, [left, onClose]);
  return [left, () => setLeft(seconds)];
}

function Shell({ children, onClose, left, total, onTouch, labelledBy, wide = false }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`bg-white w-full sm:max-w-2xl ${wide ? "lg:max-w-5xl" : ""} rounded-t-3xl sm:rounded-3xl max-h-[96dvh] flex flex-col relative toast-in overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onTouch}
      >
        <div className="absolute top-0 inset-x-0 h-1 bg-brand-borderLight/60 z-10" aria-hidden="true">
          <div className="h-full bg-brand-gold transition-[width] duration-1000 ease-linear" style={{ width: `${(Math.max(left, 0) / total) * 100}%` }} />
        </div>
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <span className="text-[11px] text-brand-softSlate tabular-nums">Closes in {Math.max(left, 0)}s</span>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-brand-warmIvory flex items-center justify-center" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- step 1 (customer): rate the technician ---------- */

// onDone(review | null): null = skipped
export function ReviewModal({ tech, hasTip, onDone, onClose }) {
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState([]);
  const [comment, setComment] = useState("");
  const [left, touch] = useAutoClose(onClose);
  const groups = stars === 0 ? [] : stars <= LOW ? BAD_GROUPS : GOOD_GROUPS;

  function pickStars(n) {
    if ((n <= LOW) !== (stars <= LOW) || stars === 0) setTags([]); // tag list changes between good / bad
    setStars(n);
  }
  const toggle = (t) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  return (
    <Shell onClose={onClose} left={left} total={AUTO_CLOSE} onTouch={touch} labelledBy="review-title" wide>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-5 pb-3 sm:px-8 sm:pt-7">
        <div className="flex items-center gap-3 pr-36">
          <Avatar name={tech.name} size={52} ring="border-brand-gold" />
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-brand-softSlate">Your technician</div>
            <h3 className="font-bold text-xl sm:text-2xl text-brand-charcoal truncate">{tech.name}</h3>
          </div>
        </div>

        <h4 id="review-title" className="font-serif text-2xl sm:text-3xl font-bold text-brand-charcoal text-center mt-5">How was your service?</h4>

        <div className="flex justify-center gap-1.5 sm:gap-3 mt-4" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={stars === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => pickStars(n)}
              className="p-1 active:scale-90 transition"
            >
              <Star size={46} strokeWidth={1.5} className={n <= stars ? "text-amber-400 fill-amber-400" : "text-brand-borderLight"} />
            </button>
          ))}
        </div>
        <p className="text-center text-sm font-bold text-brand-charcoal h-5 mt-1">{STAR_WORDS[stars]}</p>

        {stars > 0 && (
          <>
            <p className="text-center text-sm font-bold text-brand-charcoal mt-4">
              {stars <= LOW ? "What could be better?" : "What did you love?"} <span className="font-normal text-brand-softSlate">(tap any)</span>
            </p>
            <div className="mt-2 space-y-2.5 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-3">
              {groups.map(([group, GroupIcon, list]) => (
                <div key={group} className="rounded-2xl bg-brand-warmIvory/60 border border-brand-borderLight p-2.5 sm:p-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-brand-charcoal mb-2 flex items-center gap-1.5">
                    <GroupIcon size={14} className="text-brand-gold" /> {group}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2">
                    {list.map(([t, Icon]) => {
                      const on = tags.includes(t);
                      return (
                        <button
                          key={t}
                          onClick={() => toggle(t)}
                          aria-pressed={on}
                          className={`min-h-[46px] px-2.5 py-2 rounded-xl text-[13px] sm:text-sm font-semibold border transition flex items-center gap-2 text-left leading-tight active:scale-[0.97] ${
                            on ? "review-tag-on bg-brand-charcoal text-white border-brand-charcoal" : "bg-white text-brand-charcoal border-brand-borderLight"
                          }`}
                        >
                          {on ? <Check size={16} className="shrink-0" /> : <Icon size={16} className="shrink-0 text-brand-gold" />}
                          <span>{t}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={300}
              rows={1}
              placeholder="Anything else? (optional)"
              className="mt-3 w-full bg-brand-warmIvory border border-brand-borderLight rounded-xl px-3.5 py-2.5 text-base sm:text-sm focus:outline-none focus:border-brand-gold resize-none"
            />
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-brand-borderLight bg-white px-5 sm:px-8 pt-3 pb-safe-3 flex gap-2">
        <button onClick={() => onDone(null)} className="px-5 py-3.5 rounded-2xl border border-brand-borderLight text-brand-softSlate font-bold">
          Skip
        </button>
        <button
          onClick={() => stars && onDone({ stars, tags, comment })}
          disabled={!stars}
          className="flex-1 py-3.5 rounded-2xl bg-brand-charcoal text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40"
        >
          {stars ? <><Check size={18} /> {hasTip ? "Submit & tip" : "Submit"}</> : "Tap the stars to rate"}
        </button>
      </div>
    </Shell>
  );
}

/* ---------- last step (customer): thank you + Google review QR ---------- */

export function ThanksModal({ googleUrl, onClose }) {
  const [left, touch] = useAutoClose(onClose, 30);
  const [qr, setQr] = useState(null);
  useEffect(() => {
    if (!googleUrl) return;
    let alive = true;
    import("qrcode")
      .then(({ default: QRCode }) => QRCode.toDataURL(googleUrl, { errorCorrectionLevel: "M", margin: 2, width: 600 }))
      .then((u) => alive && setQr(u))
      .catch(() => {});
    return () => { alive = false; };
  }, [googleUrl]);

  return (
    <Shell onClose={onClose} left={left} total={30} onTouch={touch} labelledBy="thanks-title">
      <div className="px-6 pt-10 pb-safe-6 sm:px-10 flex flex-col items-center text-center">
        <Heart size={34} className="text-brand-gold" />
        <h3 id="thanks-title" className="font-serif text-3xl font-bold text-brand-charcoal mt-2">Thank you!</h3>
        <p className="text-sm text-brand-softSlate mt-1">We hope to see you again soon.</p>
        {googleUrl && (
          <>
            <p className="text-sm font-bold text-brand-charcoal mt-5">Enjoyed your visit? Leave us a Google review</p>
            <div className="mt-3 rounded-2xl p-2.5 bg-white qr-surface border-2 border-dashed border-brand-borderGold">
              {qr ? <img src={qr} alt="Google review QR code" className="w-[min(52vw,24svh,240px)] aspect-square" /> : <div className="w-[min(52vw,24svh,240px)] aspect-square" />}
            </div>
            <p className="text-[11px] text-brand-softSlate mt-2">Open your phone's Camera and point it at the code</p>
          </>
        )}
        <button onClick={onClose} className="mt-5 px-8 py-3 rounded-2xl bg-brand-charcoal text-white font-bold">Done</button>
      </div>
    </Shell>
  );
}

/* ---------- owner only: reviews, ratings per tech, low-rating alerts, settings ---------- */

export function OwnerReviews({ reviews = [], settings = {}, onHandled, onSaveSettings }) {
  const [view, setView] = useState("tech"); // tech | time
  const [openDay, setOpenDay] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const sorted = reviews.slice().sort((a, b) => (a.at < b.at ? 1 : -1));
  const low = sorted.filter((r) => r.stars <= LOW && !r.handled);
  const days = [...new Set(sorted.map((r) => r.date))];
  const shown = openDay ?? days[0];
  const dayList = sorted.filter((r) => r.date === shown);

  // all-time average per tech (everything kept on the board)
  const perTech = {};
  for (const r of sorted) {
    const g = (perTech[r.techName] ||= { name: r.techName, sum: 0, n: 0, tags: {} });
    g.sum += r.stars;
    g.n++;
    for (const t of r.tags || []) g.tags[t] = (g.tags[t] || 0) + 1;
  }
  const ranking = Object.values(perTech).sort((a, b) => b.sum / b.n - a.sum / a.n || b.n - a.n);

  return (
    <div className="max-w-xl mx-auto rounded-2xl border border-brand-borderGold bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-brand-charcoal flex items-center gap-2">
          <MessageSquare size={17} className="text-brand-gold" /> Customer reviews
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-lightGold text-brand-gold border border-brand-borderGold">Owner</span>
          <button onClick={() => setShowSettings((v) => !v)} className="text-xs text-brand-softSlate underline">Settings</button>
        </span>
      </div>

      {showSettings && <ReviewSettings settings={settings} onSave={onSaveSettings} />}

      {low.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2">
          <div className="text-sm font-bold text-rose-800 flex items-center gap-1.5">
            <AlertTriangle size={15} /> {low.length} low rating{low.length > 1 ? "s" : ""} to look at
          </div>
          {low.map((r) => (
            <div key={r.id} className="bg-white rounded-lg border border-rose-100 p-2.5 flex items-start gap-2">
              <div className="flex-1 min-w-0 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <b className="text-brand-charcoal">{r.techName}</b> <Stars value={r.stars} />
                  <span className="text-[11px] text-brand-softSlate">{r.date} · {time(r.at)}</span>
                </div>
                {(r.tags?.length > 0 || r.comment) && (
                  <div className="text-brand-charcoal mt-0.5">{[r.tags?.join(", "), r.comment && `“${r.comment}”`].filter(Boolean).join(" · ")}</div>
                )}
              </div>
              <button onClick={() => onHandled(r.id, true)} className="shrink-0 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold">Handled</button>
            </div>
          ))}
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-brand-softSlate">No reviews yet. Customers rate their technician in customer mode before tipping.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {ranking.map((g) => (
              <span key={g.name} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-warmIvory border border-brand-borderLight text-brand-charcoal inline-flex items-center gap-1">
                {g.name} <Star size={11} className="text-amber-400 fill-amber-400" /> {(g.sum / g.n).toFixed(1)} <span className="text-brand-softSlate">({g.n})</span>
              </span>
            ))}
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {days.map((d) => (
              <button
                key={d}
                onClick={() => setOpenDay(d)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border ${d === shown ? "bg-brand-charcoal text-white border-brand-charcoal" : "bg-white text-brand-softSlate border-brand-borderLight"}`}
              >
                {d} · {sorted.filter((r) => r.date === d).length}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 bg-brand-warmIvory border border-brand-borderLight rounded-xl p-1">
            {[["tech", "By technician"], ["time", "By time"]].map(([k, label]) => (
              <button key={k} onClick={() => setView(k)} className={`py-2 rounded-lg text-sm font-bold transition ${view === k ? "bg-white text-brand-charcoal shadow-sm" : "text-brand-softSlate"}`}>
                {label}
              </button>
            ))}
          </div>

          {view === "time" ? (
            <ReviewRows list={dayList} showName onHandled={onHandled} />
          ) : (
            <div className="space-y-3">
              {groupByTech(dayList).map((g) => (
                <div key={g.name} className="rounded-xl border border-brand-borderLight overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-brand-warmIvory">
                    <span className="font-bold text-brand-charcoal">{g.name}</span>
                    <span className="text-xs text-brand-softSlate inline-flex items-center gap-1">
                      <Star size={12} className="text-amber-400 fill-amber-400" /> <b className="text-brand-charcoal">{g.avg.toFixed(1)}</b> · {g.list.length} review{g.list.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="px-2"><ReviewRows list={g.list} onHandled={onHandled} /></div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function groupByTech(list) {
  const map = new Map();
  for (const r of list) {
    if (!map.has(r.techName)) map.set(r.techName, { name: r.techName, list: [], sum: 0 });
    const g = map.get(r.techName);
    g.list.push(r);
    g.sum += r.stars;
  }
  return [...map.values()].map((g) => ({ ...g, avg: g.sum / g.list.length })).sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name));
}

function ReviewRows({ list, showName = false, onHandled }) {
  return (
    <ul className="divide-y divide-brand-borderLight">
      {list.map((r) => (
        <li key={r.id} className="py-2.5 px-1 text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            {showName && <b className="text-brand-charcoal">{r.techName}</b>}
            <Stars value={r.stars} />
            <span className="text-[11px] text-brand-softSlate tabular-nums">{time(r.at)}</span>
            {r.stars <= LOW && (
              r.handled ? (
                <button onClick={() => onHandled(r.id, false)} className="ml-auto text-[11px] text-emerald-700 font-bold">✓ Handled</button>
              ) : (
                <span className="ml-auto text-[11px] text-rose-700 font-bold">Needs attention</span>
              )
            )}
          </div>
          {(r.tags?.length > 0 || r.comment) && (
            <div className="text-brand-charcoal mt-0.5">{[r.tags?.join(", "), r.comment && `“${r.comment}”`].filter(Boolean).join(" · ")}</div>
          )}
        </li>
      ))}
    </ul>
  );
}

function ReviewSettings({ settings, onSave }) {
  const [google, setGoogle] = useState(settings.googleUrl || DEFAULT_GOOGLE_REVIEW_URL);
  const [topic, setTopic] = useState(settings.ntfyTopic || "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const g = google.trim();
    if (g && !/^https?:\/\/\S+$/.test(g)) return setMsg("The Google link must start with https://");
    const t = topic.trim();
    if (t && !/^[A-Za-z0-9_-]{6,64}$/.test(t)) return setMsg("Alert channel: 6–64 letters, numbers, - or _ only.");
    await onSave({ googleUrl: g, ntfyTopic: t });
    setMsg("Saved.");
  }

  async function test() {
    const t = topic.trim();
    if (!t) return setMsg("Make or type an alert channel first.");
    setBusy(true);
    const ok = await sendLowAlert(t, { techName: "Test", stars: 2, tags: ["This is a test"], comment: "", at: new Date().toISOString() });
    setBusy(false);
    setMsg(ok ? "Test alert sent. Check the ntfy app on your phone." : "Couldn't send. Check the internet connection.");
  }

  const input = "w-full bg-brand-warmIvory border border-brand-borderLight rounded-xl px-3.5 py-2.5 text-base sm:text-sm focus:outline-none focus:border-brand-gold";
  return (
    <div className="rounded-xl border border-brand-borderLight bg-brand-cream/40 p-3 space-y-3">
      <label className="block">
        <span className="text-xs font-bold text-brand-softSlate flex items-center gap-1"><Link2 size={13} /> Google review link</span>
        <input value={google} onChange={(e) => { setGoogle(e.target.value); setMsg(""); }} placeholder="https://g.page/r/..." className={`${input} mt-1`} />
        <span className="text-[11px] text-brand-softSlate">Google Business Profile → “Ask for reviews” → copy the link. Every customer sees this QR after rating (Google doesn't allow showing it only to happy customers).</span>
      </label>

      <div>
        <span className="text-xs font-bold text-brand-softSlate flex items-center gap-1"><Bell size={13} /> Low-rating alert channel (free, ntfy app)</span>
        <div className="flex gap-2 mt-1">
          <input value={topic} onChange={(e) => { setTopic(e.target.value); setMsg(""); }} placeholder="salon-turn-…" className={input} />
          <button onClick={() => { setTopic(newTopic()); setMsg(""); }} className="shrink-0 px-3 rounded-xl border border-brand-borderLight text-xs font-bold">New</button>
        </div>
        <span className="text-[11px] text-brand-softSlate block mt-1">
          On your phone: install <b>ntfy</b> (App Store) → tap <b>+</b> → type this channel name exactly → Subscribe. Anyone who knows the name gets the alerts, so keep it private.
        </span>
      </div>

      {msg && <p className="text-xs font-semibold text-brand-charcoal">{msg}</p>}
      <div className="flex gap-2">
        <button onClick={save} className="flex-1 py-2.5 rounded-xl bg-brand-charcoal text-white text-sm font-bold">Save</button>
        <button onClick={test} disabled={busy} className="px-4 py-2.5 rounded-xl border border-brand-borderLight text-sm font-bold flex items-center gap-1.5 disabled:opacity-60">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send test
        </button>
      </div>
    </div>
  );
}


