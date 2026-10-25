import { useState } from "react";
import { useAvatars, nameKey, imageSrc } from "./avatars.js";

export function initials(name) {
  return (name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// Round picture for a technician; falls back to initials when there is no picture (or it fails to load)
export default function Avatar({ name, size = 40, className = "", ring = "border-brand-borderGold" }) {
  const avatars = useAvatars();
  const src = imageSrc(avatars[nameKey(name)]);
  const [broken, setBroken] = useState(null);
  const showImg = src && broken !== src;
  return (
    <span
      className={`shrink-0 inline-flex items-center justify-center rounded-full overflow-hidden border-2 bg-brand-lightGold font-serif font-bold text-brand-gold ${ring} ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {showImg ? (
        <img src={src} alt={name} className="w-full h-full object-cover" onError={() => setBroken(src)} draggable={false} />
      ) : (
        initials(name)
      )}
    </span>
  );
}
