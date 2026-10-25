import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/playfair-display/latin-600.css";
import "@fontsource/playfair-display/latin-700.css";
import "./index.css";
import App from "./App.jsx";
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

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
