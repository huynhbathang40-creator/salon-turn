// Turn a screenshot of a Zelle / Venmo QR (with banners, names, phone status bar...) into a clean QR code.
// 1) find and read the QR inside the picture, 2) draw a brand-new QR with exactly the same content,
// 3) read the new QR back to make sure it opens the same account before using it.

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("This file is not a picture."));
    img.src = src;
  });
}

function pixels(img, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

async function readQr(src) {
  const { default: jsQR } = await import("jsqr");
  const img = await loadImage(src);
  // try a few sizes: small QRs inside big screenshots read better at full size, noisy photos at smaller sizes
  for (const size of [1400, 2200, 900, 600]) {
    const data = pixels(img, size);
    const found = jsQR(data.data, data.width, data.height, { inversionAttempts: "attemptBoth" });
    if (found?.data) return found.data;
  }
  return null;
}

/** Returns { dataUrl, text } for a clean QR, or null when no QR code could be found in the picture. */
export async function cleanQr(src) {
  const text = await readQr(src);
  if (!text) return null;
  const QRCode = (await import("qrcode")).default;
  const dataUrl = await QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 720,
    color: { dark: "#000000", light: "#ffffff" },
  });
  const check = await readQr(dataUrl);
  if (check !== text) return null; // never swap in a QR that doesn't open the same thing
  return { dataUrl, text };
}

export const fileToObjectUrl = (file) => URL.createObjectURL(file);
