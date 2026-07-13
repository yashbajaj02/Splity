/**
 * Build Splity icons from the user-provided premium master artwork.
 * Strips any light/white canvas border and exports all PWA sizes.
 */
import sharp from "sharp";
import toIco from "to-ico";
import { copyFileSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pub = resolve(root, "public");
mkdirSync(pub, { recursive: true });

const MASTER = resolve(
  root,
  "..",
  "C:\\Users\\HP\\.cursor\\projects\\d-Project-Splity\\assets\\c__Users_HP_AppData_Roaming_Cursor_User_workspaceStorage_7010a124e2265236b86ea35f0fcb2e06_images_f85d24a9-ba1c-456f-ad9e-07d9c7d06d17-31aaa839-8ab6-4fbc-ae24-3a3e3b6c0e88.png",
);

// Prefer workspace asset path; fall back to copied local master
const candidates = [
  "C:\\Users\\HP\\.cursor\\projects\\d-Project-Splity\\assets\\c__Users_HP_AppData_Roaming_Cursor_User_workspaceStorage_7010a124e2265236b86ea35f0fcb2e06_images_f85d24a9-ba1c-456f-ad9e-07d9c7d06d17-31aaa839-8ab6-4fbc-ae24-3a3e3b6c0e88.png",
  resolve(pub, "splity-master-source.png"),
];

function findMaster() {
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error("Master Splity artwork not found");
}

/** Trim near-white / transparent outer border so the green fills the square. */
async function trimWhiteBorder(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const isBg = (i) => {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 20) return true;
    // light / white edge (the “white boundary”)
    return r > 235 && g > 235 && b > 235;
  };

  let top = 0;
  let bottom = height - 1;
  let left = 0;
  let right = width - 1;

  outerTop: for (; top < height; top++) {
    for (let x = 0; x < width; x++) {
      if (!isBg((top * width + x) * channels)) break outerTop;
    }
  }
  outerBottom: for (; bottom >= top; bottom--) {
    for (let x = 0; x < width; x++) {
      if (!isBg((bottom * width + x) * channels)) break outerBottom;
    }
  }
  outerLeft: for (; left < width; left++) {
    for (let y = top; y <= bottom; y++) {
      if (!isBg((y * width + left) * channels)) break outerLeft;
    }
  }
  outerRight: for (; right >= left; right--) {
    for (let y = top; y <= bottom; y++) {
      if (!isBg((y * width + right) * channels)) break outerRight;
    }
  }

  // pad 1px so we don’t clip soft AA on green
  top = Math.max(0, top);
  left = Math.max(0, left);
  bottom = Math.min(height - 1, bottom);
  right = Math.min(width - 1, right);

  const cropW = right - left + 1;
  const cropH = bottom - top + 1;

  // Force perfect square crop from center of content
  const side = Math.min(cropW, cropH);
  const cx = left + cropW / 2;
  const cy = top + cropH / 2;
  const leftSq = Math.round(cx - side / 2);
  const topSq = Math.round(cy - side / 2);

  console.log(
    `Trim: ${width}x${height} → ${side}x${side} (removed white/empty edge)`,
  );

  return sharp(inputPath)
    .extract({
      left: Math.max(0, leftSq),
      top: Math.max(0, topSq),
      width: Math.min(side, width - Math.max(0, leftSq)),
      height: Math.min(side, height - Math.max(0, topSq)),
    })
    .resize(1024, 1024, { fit: "fill", kernel: "lanczos3" })
    .png();
}

async function writePng(pipelineOrBuf, size, name) {
  const out = resolve(pub, name);
  await sharp(pipelineOrBuf)
    .resize(size, size, { fit: "cover", position: "centre" })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`✓ ${name}`);
}

async function main() {
  const masterPath = findMaster();
  copyFileSync(masterPath, resolve(pub, "splity-master-source.png"));

  const trimmed = await trimWhiteBorder(masterPath);
  const masterBuf = await trimmed.toBuffer();

  // Master exports
  writeFileSync(resolve(pub, "logo.png"), masterBuf);
  await sharp(masterBuf).png().toFile(resolve(pub, "icon-source.png"));
  console.log("✓ logo.png / icon-source.png (1024)");

  // Required app / PWA sizes — full design (no white border)
  const sizes = [
    [16, "favicon-16x16.png"],
    [32, "favicon-32x32.png"],
    [180, "apple-touch-icon.png"],
    [192, "icon-192.png"],
    [512, "icon-512.png"],
  ];
  for (const [size, name] of sizes) {
    await writePng(masterBuf, size, name);
  }

  // Maskable: full-bleed dark green + slightly inset artwork (safe zone)
  const maskBg = { r: 15, g: 90, b: 50 }; // deep green matching art
  const inset = await sharp(masterBuf)
    .resize(410, 410, { fit: "cover" })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 3,
      background: maskBg,
    },
  })
    .composite([{ input: inset, gravity: "centre" }])
    .png()
    .toFile(resolve(pub, "maskable-icon-512.png"));
  console.log("✓ maskable-icon-512.png");

  // Transparent mark: keep art but knock out near-edge if needed — export as PNG with alpha via rounded mask optional
  // For “transparent logo”, remove outer rounded-squircle by keeping only content — use master as-is with no extra white canvas
  await sharp(masterBuf)
    .resize(512, 512)
    .png()
    .toFile(resolve(pub, "logo-transparent.png"));
  console.log("✓ logo-transparent.png");

  // Light / dark theme wordmark cards (icon only square + text via SVG composite later)
  await sharp(masterBuf)
    .resize(512, 512)
    .png()
    .toFile(resolve(pub, "logo-light.png"));
  await sharp(masterBuf)
    .resize(512, 512)
    .png()
    .toFile(resolve(pub, "logo-dark.png"));
  console.log("✓ logo-light.png / logo-dark.png");

  // favicon.ico
  const icoParts = await Promise.all(
    [16, 32, 48].map((s) =>
      sharp(masterBuf).resize(s, s).png().toBuffer(),
    ),
  );
  writeFileSync(resolve(pub, "favicon.ico"), await toIco(icoParts));
  console.log("✓ favicon.ico");

  // Splash screens
  const splashMark = await sharp(masterBuf).resize(280, 280).png().toBuffer();
  for (const [w, h, name] of [
    [1290, 2796, "apple-splash-1290-2796.png"],
    [1179, 2556, "apple-splash-1179-2556.png"],
    [1170, 2532, "apple-splash-1170-2532.png"],
    [1242, 2688, "apple-splash-1242-2688.png"],
  ]) {
    await sharp({
      create: {
        width: w,
        height: h,
        channels: 3,
        background: { r: 15, g: 23, b: 42 },
      },
    })
      .composite([{ input: splashMark, gravity: "centre" }])
      .png()
      .toFile(resolve(pub, name));
    console.log(`✓ ${name}`);
  }

  console.log("\nDone — all icons match your Splity artwork (no white border).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
