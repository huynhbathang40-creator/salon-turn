import { Sun, Moon, SunMoon } from "lucide-react";
import { useTheme } from "./theme.js";

// Tap to switch: Light -> Dark -> Auto (follows the phone). Each device remembers its own choice.
const NEXT = { light: "dark", dark: "auto", auto: "light" };
const LABEL = { light: "Light mode", dark: "Dark mode", auto: "Auto (follows device)" };

export default function ThemeButton({ onMessage }) {
  const [theme, setTheme] = useTheme();
  const Icon = theme === "dark" ? Moon : theme === "auto" ? SunMoon : Sun;
  return (
    <button
      onClick={() => {
        const next = NEXT[theme] || "light";
        setTheme(next);
        onMessage?.(LABEL[next] + " on this device.");
      }}
      className="w-9 h-9 shrink-0 rounded-xl border border-brand-borderLight bg-white text-brand-charcoal flex items-center justify-center"
      aria-label={`${LABEL[theme]}. Tap to change`}
      title={LABEL[theme]}
    >
      <Icon size={17} />
    </button>
  );
}
