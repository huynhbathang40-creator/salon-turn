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

// crop: [x, y, w, h] as fractions of the picture; threshold: turn the picture pure black/white (helps colored QRs)
function pixels(img, maxSide, crop = [0, 0, 1, 1], threshold = null) {
  const W = img.naturalWidth, H = img.naturalHeight;
  const sx = crop[0] * W, sy = crop[1] * H, sw = crop[2] * W, sh = crop[3] * H;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  if (threshold !== null) {
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < threshold ? 0 : 255;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  }
  return data;
}

async function readQr(src) {
  const { default: jsQR } = await import("jsqr");
  const img = await loadImage(src);
  const tryRead = (size, crop, threshold) => {
    const data = pixels(img, size, crop, threshold);
    return jsQR(data.data, data.width, data.height, { inversionAttempts: "attemptBoth" })?.data || null;
  };
  // 1) the whole picture at a few sizes (most screenshots)
  for (const size of [1400, 2200, 900, 600]) {
    const t = tryRead(size, undefined, null);
    if (t) return t;
  }
  // 2) harder pictures (colored Venmo codes, busy screenshots): black/white + crop away banners
  const crops = [[0, 0, 1, 1], [0, 0.1, 1, 0.7], [0.05, 0.15, 0.9, 0.6], [0, 0.2, 1, 0.5], [0.1, 0.1, 0.8, 0.8]];
  for (const threshold of [160, 128, 190, 100])
    for (const crop of crops)
      for (const size of [1600, 1000, 700]) {
        const t = tryRead(size, crop, threshold);
        if (t) return t;
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
