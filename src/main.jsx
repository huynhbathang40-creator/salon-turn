import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/playfair-display/latin-600.css";
import "@fontsource/playfair-display/latin-700.css";
import "./index.css";
import "./dark.css";
import { applyTheme } from "./theme.js";

applyTheme();
import App from "./App.jsx";
import PhoneRate from "./PhoneRate.jsx";
import { registerSW } from "virtual:pwa-register";

// When a new version is published, switch to it right away (and check again whenever the app comes back to the screen)
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const check = () => document.visibilityState === "visible" && reg.update().catch(() => {});
    document.addEventListener("visibilitychange", check);
    setInterval(check, 30 * 60 * 1000);
  },
});
void updateSW;

// drop the old tip cache that kept showing QR screenshots after they were cleaned
if ("caches" in window) caches.delete("tip-staff").catch(() => {});
try { localStorage.removeItem("salon-turn-tips-list-v1"); } catch { /* ignore */ }

// ?rate=<code>: the review page a customer opens on their own phone (QR on the salon iPad)
const rateCode = new URLSearchParams(window.location.search).get("rate");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {rateCode ? <PhoneRate code={rateCode} /> : <App />}
  </React.StrictMode>
);
