import { useEffect, useState } from "react";
import { Loader2, Send, Trash2, RefreshCw } from "lucide-react";
import { getClient, hasCloud } from "./db.js";
import { getToken } from "./auth.js";

// Low-rating alerts on Telegram. The bot token lives only on the server (Supabase);
// the server sends the message itself the moment a <=3★ review is saved (iPad or customer's phone).
async function call(fn, args = {}) {
  if (!hasCloud) throw new Error("Needs the cloud connection");
  const sb = await getClient();
  const { data, error } = await sb.rpc(fn, { p_token: getToken(), ...args });
  if (error) throw new Error((error.message || "").replace(/^.*?:\s*/, "") || "Something went wrong");
  return data;
}

const TgIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#29A9EB" /><path fill="#fff" d="M5.4 11.8 17 7.3c.5-.2 1 .1.8.9l-2 9.3c-.1.6-.5.8-1 .5l-3-2.2-1.4 1.4c-.2.2-.3.3-.6.3l.2-3.1 5.6-5c.2-.2 0-.3-.3-.1l-6.9 4.3-3-.9c-.6-.2-.6-.6.1-.9z" /></svg>
);

export default function TelegramAlerts() {
  const [st, setSt] = useState(null); // {ready, bot, chats}
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    call("telegram_status").then(setSt).catch(() => setSt({ ready: false, chats: [], unavailable: true }));
  }, []);

  async function run(kind, fn) {
    setBusy(kind); setMsg("");
    try { await fn(); } catch (e) { setMsg(e.message); }
    setBusy("");
  }

  const link = () => run("link", async () => {
    const before = st?.chats?.length || 0;
    const chats = await call("telegram_link");
    setSt((s) => ({ ...s, chats }));
    setMsg(chats.length > before ? "Connected! Tap “Send test” to check." : "No new phone found. Open the bot in Telegram, tap Start (or send it any message), then tap Connect again.");
  });
  const test = () => run("test", async () => {
    const n = await call("telegram_test");
    setMsg(n ? `Test sent to ${n} Telegram chat${n > 1 ? "s" : ""}.` : "No phone connected yet.");
  });
  const remove = (id) => run("rm" + id, async () => {
    const chats = await call("telegram_remove", { p_chat: String(id) });
    setSt((s) => ({ ...s, chats }));
  });

  const btn = "px-3 py-2 rounded-xl border border-brand-borderLight text-xs font-bold flex items-center gap-1.5 disabled:opacity-60";
  return (
    <div className="rounded-xl border border-brand-borderLight bg-brand-cream/40 p-3 space-y-2">
      <span className="text-xs font-bold text-brand-softSlate flex items-center gap-1.5"><TgIcon /> Low-rating alerts on Telegram (fast)</span>
      {!st ? (
        <Loader2 size={16} className="animate-spin text-brand-softSlate" />
      ) : !st.ready ? (
        <p className="text-[11px] text-brand-softSlate">{st.unavailable ? "Not available right now." : "The Telegram bot isn't set up yet."}</p>
      ) : (
        <>
          <p className="text-[11px] text-brand-softSlate">
            To add a phone: open <b>{st.bot ? `@${st.bot}` : "the salon bot"}</b> in Telegram → tap <b>Start</b> → come back and tap <b>Connect</b>.
          </p>
          {st.chats?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {st.chats.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-white border border-brand-borderLight text-xs font-semibold text-brand-charcoal">
                  {c.name}
                  <button onClick={() => remove(c.id)} disabled={!!busy} aria-label={`Remove ${c.name}`} className="w-5 h-5 rounded-full flex items-center justify-center text-brand-softSlate hover:text-rose-600">
                    {busy === "rm" + c.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={link} disabled={!!busy} className={btn}>{busy === "link" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Connect</button>
            <button onClick={test} disabled={!!busy || !st.chats?.length} className={btn}>{busy === "test" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send test</button>
          </div>
        </>
      )}
      {msg && <p className="text-xs font-semibold text-brand-charcoal">{msg}</p>}
    </div>
  );
}
