import { useEffect, useState } from "react";
import {
  Star, X, Check, AlertTriangle, RotateCcw, ChevronDown, Bell, Loader2, Send, Link2, MessageSquare, Heart,
  Camera, Smile, Feather, BadgeCheck, MessageCircle, Ear, Clock, Sparkles, Target, Gem, Droplet, Palette, Leaf,
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

export function ThanksModal({ googleUrl, onClose, onTip, tipName }) {
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
      <div className="px-5 pt-9 pb-safe-6 sm:px-10 flex flex-col items-center text-center">
        <h3 id="thanks-title" className="font-serif text-3xl font-bold text-brand-charcoal flex items-center gap-2"><Heart size={26} className="text-brand-gold fill-current" /> Thank you!</h3>
        <p className="text-sm text-brand-softSlate mt-0.5">We hope to see you again soon.</p>
        {googleUrl && (
          <div className="google-cta mt-5 w-full max-w-md rounded-3xl border-2 p-4 sm:p-5 flex flex-col items-center">
            <div className="flex items-center gap-2">
              <GoogleG />
              <span className="flex gap-0.5" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={22} className="text-amber-400 fill-amber-400" />)}
              </span>
            </div>
            <p className="google-cta-title font-serif font-bold text-2xl sm:text-3xl leading-tight mt-2">Enjoyed your visit?</p>
            <p className="google-cta-sub text-base sm:text-xl font-bold mt-0.5">Leave us a Google review</p>
            <div className="mt-3 rounded-2xl p-2 bg-white qr-surface border-2 border-dashed border-brand-borderGold">
              {qr ? <img src={qr} alt="Google review QR code" className="w-[min(50vw,24svh,260px)] aspect-square" /> : <div className="w-[min(50vw,24svh,260px)] aspect-square" />}
            </div>
            <p className="google-cta-hint text-sm font-semibold mt-2 flex items-center gap-1.5">
              <Camera size={16} /> Point your phone's Camera at the code
            </p>
          </div>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {onTip && (
            <button onClick={onTip} className="px-6 py-3 rounded-2xl border-2 border-brand-gold text-brand-charcoal font-bold flex items-center gap-2">
              <Heart size={18} className="text-brand-gold fill-current" /> Tip {tipName ? tipName.split(" ")[0] : "your technician"}
            </button>
          )}
          <button onClick={onClose} className="px-8 py-3 rounded-2xl bg-brand-charcoal text-white font-bold">Done</button>
        </div>
      </div>
    </Shell>
  );
}

// Google's "G" mark, drawn in its four colors
function GoogleG() {
  return (
    <svg width="26" height="26" viewBox="0 0 48 48" aria-label="Google">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.2-3.9 7.2-9.6 7.2-17z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.3-4.6 2.2-8.8 2.2-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/* ---------- owner only: reviews, ratings per tech, low-rating alerts, settings ---------- */

export function OwnerReviews({ reviews = [], settings = {}, onHandled, onSaveSettings, onReset, onDelete }) {
  const [view, setView] = useState("tech"); // tech | time
  const [pickedTech, setPickedTech] = useState(null); // tap a tech chip -> only that tech's reviews
  const [confirmReset, setConfirmReset] = useState(false);
  const [openDay, setOpenDay] = useState(null);
  // Show / Hide, remembered on this device (shown the first time)
  const [open, setOpenState] = useState(() => { try { return localStorage.getItem("salon-turn-reviews-open") !== "0"; } catch { return true; } });
  const setOpen = (v) => { setOpenState(v); try { localStorage.setItem("salon-turn-reviews-open", v ? "1" : "0"); } catch { /* ignore */ } };

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
    <div className="max-w-xl mx-auto lg:max-w-none lg:mx-0 w-full rounded-2xl border border-brand-borderGold bg-white p-4 lg:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-bold text-brand-charcoal flex items-center gap-2">
          <MessageSquare size={17} className="text-brand-gold" /> Customer reviews
          <span className="text-xs font-semibold text-brand-softSlate">({reviews.length})</span>
          {!open && low.length > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white">{low.length} low</span>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          {open && reviews.length > 0 && onReset && (
            <button onClick={() => setConfirmReset(true)} className="text-xs font-bold px-2.5 py-1 rounded-full border border-rose-200 text-rose-700 inline-flex items-center gap-1">
              <RotateCcw size={12} /> Reset
            </button>
          )}
          <button
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="px-3 py-1.5 rounded-full border border-brand-borderLight text-xs font-bold text-brand-charcoal inline-flex items-center gap-1"
          >
            {open ? "Hide" : "Show"} <ChevronDown size={14} className={`transition ${open ? "rotate-180" : ""}`} />
          </button>
        </span>
      </div>

      {open && (<>

      {confirmReset && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm">
          <p className="font-bold text-rose-800">Delete all {reviews.length} reviews and start fresh?</p>
          <p className="text-rose-800/80 text-xs mt-0.5">Ratings, comments and averages are cleared on every device. This can't be undone.</p>
          <div className="flex gap-2 mt-2.5">
            <button onClick={() => { onReset(); setConfirmReset(false); setPickedTech(null); setOpenDay(null); }} className="px-3.5 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold">Yes, reset reviews</button>
            <button onClick={() => setConfirmReset(false)} className="px-3.5 py-2 rounded-lg border border-brand-borderLight bg-white text-xs font-bold">Cancel</button>
          </div>
        </div>
      )}


      {low.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2">
          <div className="text-sm font-bold text-rose-800 flex items-center gap-1.5">
            <AlertTriangle size={15} /> {low.length} low rating{low.length > 1 ? "s" : ""} to look at
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
          {low.map((r) => (
            <div key={r.id} className="bg-white rounded-lg border border-rose-100 p-2.5 flex items-start gap-2">
              <div className="flex-1 min-w-0 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <b className="text-brand-charcoal">{r.techName}</b> <Stars value={r.stars} />
                  <span className="text-[11px] text-brand-softSlate">{r.date} · {time(r.at)}</span>
                  <AlertState r={r} />
                </div>
                {(r.tags?.length > 0 || r.comment) && (
                  <div className="text-brand-charcoal mt-0.5">{[r.tags?.join(", "), r.comment && `“${r.comment}”`].filter(Boolean).join(" · ")}</div>
                )}
              </div>
              <div className="shrink-0 flex items-center gap-1">
                <button onClick={() => onHandled(r.id, true)} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold">Handled</button>
                {onDelete && <DeleteReview onDelete={() => onDelete(r.id)} />}
              </div>
            </div>
          ))}
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-brand-softSlate">No reviews yet. Customers rate their technician in customer mode.</p>
      ) : (
        <>
          {/* Google-style summary: average on the left, 5→1 star bars on the right; technicians next to it on iPad */}
          <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:gap-6 lg:items-start">
          <RatingSummary list={sorted} />
          <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-brand-softSlate">Technicians</div>
          <div className="flex flex-wrap gap-1.5">
            {ranking.map((g) => {
              const on = pickedTech === g.name;
              return (
                <button
                  key={g.name}
                  onClick={() => setPickedTech(on ? null : g.name)}
                  aria-pressed={on}
                  className={`text-sm font-semibold px-3 py-1.5 rounded-full border inline-flex items-center gap-1 active:scale-95 transition ${
                    on ? "review-tag-on bg-brand-charcoal text-white border-brand-charcoal" : "bg-brand-warmIvory border-brand-borderLight text-brand-charcoal"
                  }`}
                >
                  {g.name} <Star size={12} className="text-amber-400 fill-amber-400" /> {(g.sum / g.n).toFixed(1)} <span className={on ? "opacity-80" : "text-brand-softSlate"}>({g.n})</span>
                </button>
              );
            })}
          </div>
          {!pickedTech && <p className="text-[11px] text-brand-softSlate ">Tap a technician to see only their reviews.</p>}
          </div>
          </div>

          {pickedTech ? (
            <TechReviews name={pickedTech} list={sorted.filter((r) => r.techName === pickedTech)} onHandled={onHandled} onDelete={onDelete} onClose={() => setPickedTech(null)} />
          ) : (<>

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
            <ReviewRows list={dayList} showName cards onHandled={onHandled} onDelete={onDelete} />
          ) : (
            <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-3 lg:items-start">
              {groupByTech(dayList).map((g) => (
                <div key={g.name} className="rounded-xl border border-brand-borderLight overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-brand-warmIvory">
                    <span className="font-bold text-brand-charcoal">{g.name}</span>
                    <span className="text-xs text-brand-softSlate inline-flex items-center gap-1">
                      <Star size={12} className="text-amber-400 fill-amber-400" /> <b className="text-brand-charcoal">{g.avg.toFixed(1)}</b> · {g.list.length} review{g.list.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="px-2"><ReviewRows list={g.list} onHandled={onHandled} onDelete={onDelete} /></div>
                </div>
              ))}
            </div>
          )}
          </>)}
        </>
      )}
      </>)}
    </div>
  );
}

// one technician's reviews, newest first, with date + time
function TechReviews({ name, list, onHandled, onDelete, onClose }) {
  const avg = list.reduce((a, r) => a + r.stars, 0) / (list.length || 1);
  const counts = [5, 4, 3, 2, 1].map((n) => [n, list.filter((r) => r.stars === n).length]);
  const tagCount = {};
  for (const r of list) for (const t of r.tags || []) tagCount[t] = (tagCount[t] || 0) + 1;
  const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return (
    <div className="rounded-xl border border-brand-borderGold overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 bg-brand-warmIvory">
        <span className="font-bold text-brand-charcoal text-base">{name}</span>
        <span className="flex items-center gap-2">
          <span className="text-sm inline-flex items-center gap-1"><Star size={14} className="text-amber-400 fill-amber-400" /> <b>{avg.toFixed(1)}</b> <span className="text-brand-softSlate text-xs">· {list.length} review{list.length > 1 ? "s" : ""}</span></span>
          <button onClick={onClose} className="w-7 h-7 rounded-full border border-brand-borderLight bg-white flex items-center justify-center" aria-label="Show all technicians"><X size={14} /></button>
        </span>
      </div>
      <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-4">
      <div className="lg:border-r lg:border-brand-borderLight lg:pb-3">
      <div className="px-3 pt-3"><RatingSummary list={list} /></div>
      {topTags.length > 0 && (
        <div className="px-3 pt-2.5 flex flex-wrap gap-1.5">
          {topTags.map(([t, c]) => (
            <span key={t} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white border border-brand-borderLight text-brand-charcoal">{t} × {c}</span>
          ))}
        </div>
      )}
      </div>
      <div className="px-2 pt-1 lg:pt-2 lg:pr-3"><ReviewRows list={list} showDate onHandled={onHandled} onDelete={onDelete} /></div>
      </div>
    </div>
  );
}

// like the rating box on Google: big average + stars + count, and a bar for each star level
function RatingSummary({ list }) {
  const n = list.length;
  const avg = n ? list.reduce((a, r) => a + r.stars, 0) / n : 0;
  const counts = [5, 4, 3, 2, 1].map((s) => [s, list.filter((r) => r.stars === s).length]);
  return (
    <div className="rounded-xl border border-brand-borderLight bg-brand-warmIvory/50 p-3 sm:p-4 flex items-center gap-4 sm:gap-6">
      <div className="text-center shrink-0 w-24 sm:w-28">
        <div className="font-serif text-5xl font-bold text-brand-charcoal leading-none tabular-nums">{avg.toFixed(1)}</div>
        <div className="flex justify-center gap-0.5 mt-2">
          {[1, 2, 3, 4, 5].map((s) => {
            const fill = Math.max(0, Math.min(1, avg - (s - 1)));
            return (
              <span key={s} className="relative inline-block w-4 h-4">
                <Star size={16} className="absolute inset-0 text-brand-borderLight" />
                <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                  <Star size={16} className="text-amber-400 fill-amber-400" />
                </span>
              </span>
            );
          })}
        </div>
        <div className="text-xs text-brand-softSlate mt-1.5">{n} review{n === 1 ? "" : "s"}</div>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        {counts.map(([s, c]) => (
          <div key={s} className="flex items-center gap-2 text-xs">
            <span className="w-3 text-right font-semibold text-brand-charcoal tabular-nums">{s}</span>
            <span className="flex-1 h-2.5 rounded-full bg-brand-borderLight/70 overflow-hidden">
              <span className="block h-full rounded-full bg-amber-400" style={{ width: `${n ? (c / n) * 100 : 0}%` }} />
            </span>
            <span className="w-6 text-right tabular-nums text-brand-softSlate">{c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// did the phone alert for this low rating go out?
function AlertState({ r }) {
  if (!r.alert) return null;
  const map = {
    sent: ["Alert sent", "text-emerald-700"],
    failed: ["Alert failed to send", "text-rose-700"],
    "no-channel": ["No alert channel set", "text-amber-700"],
  };
  const [label, cls] = map[r.alert] || [];
  return label ? <span className={`text-[11px] font-semibold ${cls} inline-flex items-center gap-1`}><Bell size={11} /> {label}</span> : null;
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

// cards = on iPad, two columns of small cards: newest at the top of the left column, then down, then the right column
// delete one review (e.g. a test): tap the bin, then confirm
function DeleteReview({ onDelete }) {
  const [ask, setAsk] = useState(false);
  useEffect(() => {
    if (!ask) return;
    const t = setTimeout(() => setAsk(false), 5000);
    return () => clearTimeout(t);
  }, [ask]);
  return ask ? (
    <span className="flex items-center gap-1">
      <button onClick={() => { setAsk(false); onDelete(); }} className="px-2 py-1 rounded-md bg-rose-600 text-white text-[11px] font-bold">Delete</button>
      <button onClick={() => setAsk(false)} className="px-2 py-1 rounded-md border border-brand-borderLight text-brand-softSlate text-[11px] font-bold">Cancel</button>
    </span>
  ) : (
    <button onClick={() => setAsk(true)} className="w-7 h-7 rounded-md flex items-center justify-center text-brand-softSlate/70 hover:text-rose-600 active:bg-rose-50" aria-label="Delete this review">
      <Trash2 size={14} />
    </button>
  );
}

function ReviewRows({ list, showName = false, showDate = false, cards = false, onHandled, onDelete }) {
  return (
    <ul className={cards ? "divide-y divide-brand-borderLight lg:divide-y-0 lg:columns-2 lg:gap-2" : "divide-y divide-brand-borderLight"}>
      {list.map((r) => (
        <li key={r.id} className={`py-2.5 px-1 text-sm ${cards ? "lg:rounded-xl lg:border lg:border-brand-borderLight lg:px-3 lg:py-2.5 lg:mb-2 lg:break-inside-avoid" : ""}`}>
          <div className="flex items-center gap-2 flex-wrap">
            {showName && <b className="text-brand-charcoal">{r.techName}</b>}
            <Stars value={r.stars} />
            <span className="text-[11px] text-brand-softSlate tabular-nums">{showDate ? `${r.date} · ` : ""}{time(r.at)}</span>
            {r.source === "phone" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">Phone</span>}
            <span className="ml-auto flex items-center gap-2">
              {r.stars <= LOW && (
                r.handled ? (
                  <button onClick={() => onHandled(r.id, false)} className="text-[11px] text-emerald-700 font-bold">✓ Handled</button>
                ) : (
                  <span className="text-[11px] text-rose-700 font-bold">Needs attention</span>
                )
              )}
              {onDelete && <DeleteReview onDelete={() => onDelete(r.id)} />}
            </span>
          </div>
          {(r.tags?.length > 0 || r.comment) && (
            <div className="text-brand-charcoal mt-0.5">{[r.tags?.join(", "), r.comment && `“${r.comment}”`].filter(Boolean).join(" · ")}</div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ReviewSettings({ settings, onSave }) {
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


