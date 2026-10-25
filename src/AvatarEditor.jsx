import { useEffect, useRef, useState } from "react";
import { X, Camera, Image as ImageIcon, Link2, Trash2, Loader2 } from "lucide-react";
import Avatar from "./Avatar.jsx";
import { PRESETS, presetUrl, fileToSquare, saveAvatar, removeAvatar, useAvatars, nameKey } from "./avatars.js";

// Change a technician's picture: take a photo, pick from Photos/Files, paste a web link, or choose an icon
export default function AvatarEditor({ name, onClose, onSaved }) {
  const avatars = useAvatars();
  const current = avatars[nameKey(name)];
  const cameraRef = useRef(null);
  const fileRef = useRef(null);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function apply(image) {
    setBusy(true);
    setError("");
    try {
      await saveAvatar(name, image);
      onSaved?.(`${name}'s picture updated.`);
      onClose();
    } catch (e) {
      console.error(e);
      setError("Could not save. Check the internet connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setBusy(true);
      await apply(await fileToSquare(file));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  function onLink(e) {
    e.preventDefault();
    const url = link.trim();
    if (!/^https:\/\/\S+$/i.test(url)) return setError("Paste a full image link that starts with https://");
    // check that the link really is a picture before saving it
    setBusy(true);
    const img = new Image();
    img.onload = () => apply(url);
    img.onerror = () => {
      setBusy(false);
      setError("That link is not a picture. Long-press the image on the website and choose “Copy Image Address”, or save it to Photos and use “Photos / Files”.");
    };
    img.src = url;
  }

  async function onRemove() {
    setBusy(true);
    try {
      await removeAvatar(name);
      onSaved?.(`${name}'s picture removed.`);
      onClose();
    } catch {
      setError("Could not remove. Try again.");
      setBusy(false);
    }
  }

  const tile = "flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl border border-brand-borderLight bg-brand-warmIvory text-sm font-bold text-brand-charcoal active:scale-95";

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 pb-safe max-h-[94vh] overflow-y-auto relative toast-in" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-brand-warmIvory flex items-center justify-center" aria-label="Close">
          <X size={18} />
        </button>

        <div className="flex flex-col items-center gap-2 pt-1">
          <div className="relative">
            <Avatar name={name} size={88} />
            {busy && (
              <span className="absolute inset-0 rounded-full bg-white/70 flex items-center justify-center">
                <Loader2 className="animate-spin text-brand-gold" />
              </span>
            )}
          </div>
          <h3 className="font-bold text-lg text-brand-charcoal">{name}</h3>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <button className={tile} onClick={() => cameraRef.current?.click()} disabled={busy}>
            <Camera size={22} className="text-brand-gold" /> Take photo
          </button>
          <button className={tile} onClick={() => fileRef.current?.click()} disabled={busy}>
            <ImageIcon size={22} className="text-brand-gold" /> Photos / Files
          </button>
        </div>
        {/* capture opens the camera directly; the second input lets iPhone offer Photo Library, Files, or Camera */}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

        <form onSubmit={onLink} className="flex gap-2 mt-2.5">
          <div className="relative flex-1 min-w-0">
            <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-softSlate" />
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Paste image link (https://…)"
              inputMode="url"
              className="w-full bg-brand-warmIvory border border-brand-borderLight rounded-xl pl-9 pr-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-brand-gold"
            />
          </div>
          <button type="submit" disabled={busy || !link.trim()} className="px-4 rounded-xl bg-brand-charcoal text-white text-sm font-bold disabled:opacity-40">
            Use
          </button>
        </form>

        <p className="text-xs font-bold uppercase tracking-wider text-brand-softSlate mt-5 mb-2">No photo? Pick an icon</p>
        <div className="grid grid-cols-6 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => apply(p.id)}
              disabled={busy}
              className={`aspect-square rounded-full overflow-hidden border-2 active:scale-95 ${current === p.id ? "border-brand-gold ring-2 ring-brand-gold/40" : "border-transparent"}`}
              aria-label={p.g === "f" ? "Female icon" : "Male icon"}
            >
              <img src={presetUrl(p.id)} alt="" className="w-full h-full" />
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

        {current && (
          <button onClick={onRemove} disabled={busy} className="mt-5 w-full py-2.5 rounded-xl border border-rose-200 text-rose-700 text-sm font-semibold flex items-center justify-center gap-1.5">
            <Trash2 size={14} /> Remove picture (show initials)
          </button>
        )}
      </div>
    </div>
  );
}
