#!/usr/bin/env node
/**
 * optimize-media.mjs
 * 
 * Pipeline de optimización de video e imagen para WebGL carousels.
 * 
 * Uso:
 *   node optimize-media.mjs
 *   node optimize-media.mjs --only-videos
 *   node optimize-media.mjs --only-images
 * 
 * Genera en /public/motion/optimized/:
 *   video.mobile.mp4    → H.264 720x1280, CRF 32, sin audio
 *   video.mobile.webm   → VP9 720x1280, CRF 40, sin audio
 *   video.desktop.mp4   → H.264 1080p,   CRF 26, sin audio
 *   video.desktop.webm  → VP9 1080p,     CRF 33, sin audio
 *   video.poster.webp   → primer frame del video
 * 
 * Genera en /public/story/optimized/:
 *   image.mobile.webp   → 800px wide,   quality 75
 *   image.desktop.webp  → 1600px wide,  quality 85
 *   image.mobile.jpg    → fallback JPEG 800px
 *   image.desktop.jpg   → fallback JPEG 1600px
 * 
 * Al final genera /public/media-manifest.json con los paths correctos
 * para consumir desde el componente React.
 */

import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CONFIG ────────────────────────────────────────────────────────────────

const CONFIG = {
  videosDir: path.join(__dirname, "public", "motion"),
  imagesDir: path.join(__dirname, "public", "story"),
  outputVideos: path.join(__dirname, "public", "motion", "optimized"),
  outputImages: path.join(__dirname, "public", "story", "optimized"),
  manifestPath: path.join(__dirname, "public", "media-manifest.json"),

  video: {
    mobile: {
      width: 720,
      height: 1280,
      mp4: { crf: 32, preset: "slow", profile: "baseline", level: "3.1" },
      webm: { crf: 40, qmin: 33, qmax: 45, speed: 2 },
    },
    desktop: {
      width: 1920,
      height: 1080,
      mp4: { crf: 26, preset: "slow", profile: "high", level: "4.2" },
      webm: { crf: 33, qmin: 25, qmax: 38, speed: 1 },
    },
    poster: { quality: 90 },
    extensions: [".mp4", ".mov", ".webm", ".avi", ".mkv"],
  },

  image: {
    mobile: { width: 800, webpQuality: 75, jpgQuality: 80 },
    desktop: { width: 1600, webpQuality: 85, jpgQuality: 88 },
    extensions: [".jpg", ".jpeg", ".png", ".webp", ".tiff"],
  },
};

// ─── UTILS ─────────────────────────────────────────────────────────────────

const log = {
  info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  ok: (msg) => console.log(`\x1b[32m[OK]\x1b[0m ${msg}`),
  skip: (msg) => console.log(`\x1b[33m[SKIP]\x1b[0m ${msg}`),
  error: (msg) => console.error(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  section: (msg) => console.log(`\n\x1b[1m\x1b[35m═══ ${msg} ═══\x1b[0m\n`),
};

const checkFfmpeg = () => {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    execSync("ffprobe -version", { stdio: "ignore" });
    return true;
  } catch {
    log.error("FFmpeg no encontrado. Instálalo con: brew install ffmpeg (macOS) | apt install ffmpeg (Linux)");
    process.exit(1);
  }
};

const checkSharp = async () => {
  try {
    const sharp = await import("sharp");
    return sharp.default;
  } catch {
    log.error("Sharp no encontrado. Ejecuta: npm install sharp");
    process.exit(1);
  }
};

const getFileSize = (filePath) => {
  try {
    const bytes = fs.statSync(filePath).size;
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
    return `${(bytes / 1024).toFixed(0)}KB`;
  } catch {
    return "?";
  }
};

const formatReduction = (originalPath, outputPath) => {
  try {
    const original = fs.statSync(originalPath).size;
    const output = fs.statSync(outputPath).size;
    const pct = (((original - output) / original) * 100).toFixed(0);
    return `${getFileSize(originalPath)} → ${getFileSize(outputPath)} (-${pct}%)`;
  } catch {
    return "";
  }
};

const runFfmpeg = (args) =>
  new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let errOutput = "";
    proc.stderr.on("data", (d) => (errOutput += d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(errOutput.slice(-500)));
    });
  });

const getVideoInfo = (inputPath) => {
  const raw = execSync(
    `ffprobe -v quiet -print_format json -show_streams "${inputPath}"`,
    { encoding: "utf-8" }
  );
  const info = JSON.parse(raw);
  const video = info.streams.find((s) => s.codec_type === "video");
  return {
    width: video?.width,
    height: video?.height,
    duration: parseFloat(video?.duration || 0),
  };
};

/**
 * Calcula el filtro de escala manteniendo aspecto y ajustando
 * a múltiplos de 2 (requerimiento de H.264/VP9).
 */
const scaleFilter = (targetW, targetH, srcW, srcH) => {
    // Simplemente escala al ancho target manteniendo la proporción original.
    // applyMediaAspect en Three.js se encarga del resto, igual que con los originales.
    const targetSize = targetW;
    return `scale=${targetSize}:-2`; // -2 = altura calculada automáticamente, múltiplo de 2
  };

// ─── VIDEO OPTIMIZATION ────────────────────────────────────────────────────

const optimizeVideoVariant = async (inputPath, outputPath, variant, format) => {
  if (fs.existsSync(outputPath)) {
    log.skip(`Ya existe: ${path.basename(outputPath)}`);
    return false;
  }

  const { width: srcW, height: srcH } = getVideoInfo(inputPath);
  const { width, height } = CONFIG.video[variant];
  const filter = scaleFilter(width, height, srcW, srcH);
  const cfg = CONFIG.video[variant][format];
  let args;

  if (format === "mp4") {
    args = [
      "-y",
      "-i", inputPath,
      "-vf", filter,
      "-c:v", "libx264",
      "-crf", String(cfg.crf),
      "-preset", cfg.preset,
      "-profile:v", cfg.profile,
      "-level", cfg.level,
      "-movflags", "+faststart",  // permite streaming progresivo
      "-an",                       // sin audio (videos están muted)
      "-pix_fmt", "yuv420p",       // compatibilidad máxima
      outputPath,
    ];
  } else if (format === "webm") {
    // VP9 two-pass para mejor calidad/peso
    const passlogPath = outputPath.replace(".webm", "_pass");
    args = [
      "-y",
      "-i", inputPath,
      "-vf", filter,
      "-c:v", "libvpx-vp9",
      "-crf", String(cfg.crf),
      "-b:v", "0",               // modo CRF puro (sin target bitrate)
      "-qmin", String(cfg.qmin),
      "-qmax", String(cfg.qmax),
      "-speed", String(cfg.speed),
      "-tile-columns", "2",
      "-frame-parallel", "1",
      "-auto-alt-ref", "1",
      "-lag-in-frames", "25",
      "-an",
      "-pass", "1",
      "-passlogfile", passlogPath,
      "-f", "null",
      "/dev/null",
    ];
    await runFfmpeg(args);
    args = [
      "-y",
      "-i", inputPath,
      "-vf", filter,
      "-c:v", "libvpx-vp9",
      "-crf", String(cfg.crf),
      "-b:v", "0",
      "-qmin", String(cfg.qmin),
      "-qmax", String(cfg.qmax),
      "-speed", "1",
      "-tile-columns", "2",
      "-frame-parallel", "1",
      "-auto-alt-ref", "1",
      "-lag-in-frames", "25",
      "-an",
      "-pass", "2",
      "-passlogfile", passlogPath,
      outputPath,
    ];
    await runFfmpeg(args);
    // limpiar archivos de passlog
    [`${passlogPath}-0.log`, `${passlogPath}-0.log.mbtree`].forEach((f) => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });
    return true;
  }

  await runFfmpeg(args);
  return true;
};

const extractPoster = async (inputPath, outputPath) => {
  if (fs.existsSync(outputPath)) {
    log.skip(`Poster ya existe: ${path.basename(outputPath)}`);
    return;
  }
  // JPEG es universal en ffmpeg; WebP puede fallar si no está compilado libwebp
  await runFfmpeg([
    "-y",
    "-ss", "0.001",
    "-i", inputPath,
    "-frames:v", "1",
    "-q:v", "2",
    "-f", "image2",
    outputPath,
  ]);
};

const processVideo = async (inputPath, baseName) => {
  const out = CONFIG.outputVideos;
  const base = path.join(out, baseName);
  const result = { original: `/motion/${path.basename(inputPath)}` };

  try {
    log.info(`Procesando video: ${path.basename(inputPath)}`);

    for (const variant of ["mobile", "desktop"]) {
      for (const format of ["mp4", "webm"]) {
        const outputPath = `${base}.${variant}.${format}`;
        const created = await optimizeVideoVariant(inputPath, outputPath, variant, format);
        if (created || fs.existsSync(outputPath)) {
          log.ok(`${variant}.${format}: ${formatReduction(inputPath, outputPath)}`);
          result[`${variant}_${format}`] = `/motion/optimized/${baseName}.${variant}.${format}`;
        }
      }
    }

    // Poster desde la versión mobile mp4 (JPEG = compatible con cualquier ffmpeg)
    const posterPath = `${base}.poster.jpg`;
    const sourceForPoster = `${base}.mobile.mp4`;
    if (fs.existsSync(sourceForPoster)) {
      await extractPoster(sourceForPoster, posterPath);
      if (fs.existsSync(posterPath)) {
        log.ok(`poster: ${getFileSize(posterPath)}`);
        result.poster = `/motion/optimized/${baseName}.poster.jpg`;
      }
    }
  } catch (err) {
    log.error(`Error procesando ${path.basename(inputPath)}: ${err.message}`);
  }

  return result;
};

// ─── IMAGE OPTIMIZATION ────────────────────────────────────────────────────

const processImage = async (sharp, inputPath, baseName) => {
  const out = CONFIG.outputImages;
  const result = { original: `/story/${path.basename(inputPath)}` };

  try {
    log.info(`Procesando imagen: ${path.basename(inputPath)}`);
    const { mobile, desktop } = CONFIG.image;

    for (const [variant, cfg] of [["mobile", mobile], ["desktop", desktop]]) {
      // WebP
      const webpPath = path.join(out, `${baseName}.${variant}.webp`);
      if (!fs.existsSync(webpPath)) {
        await sharp(inputPath)
          .resize(cfg.width, null, { withoutEnlargement: true, fit: "inside" })
          .webp({ quality: cfg.webpQuality, effort: 6 })
          .toFile(webpPath);
        log.ok(`${variant}.webp: ${formatReduction(inputPath, webpPath)}`);
      } else {
        log.skip(`Ya existe: ${path.basename(webpPath)}`);
      }
      result[`${variant}_webp`] = `/story/optimized/${baseName}.${variant}.webp`;

      // JPEG fallback
      const jpgPath = path.join(out, `${baseName}.${variant}.jpg`);
      if (!fs.existsSync(jpgPath)) {
        await sharp(inputPath)
          .resize(cfg.width, null, { withoutEnlargement: true, fit: "inside" })
          .jpeg({ quality: cfg.jpgQuality, progressive: true, mozjpeg: true })
          .toFile(jpgPath);
        log.ok(`${variant}.jpg: ${formatReduction(inputPath, jpgPath)}`);
      } else {
        log.skip(`Ya existe: ${path.basename(jpgPath)}`);
      }
      result[`${variant}_jpg`] = `/story/optimized/${baseName}.${variant}.jpg`;
    }
  } catch (err) {
    log.error(`Error procesando ${path.basename(inputPath)}: ${err.message}`);
  }

  return result;
};

// ─── MAIN ──────────────────────────────────────────────────────────────────

const main = async () => {
  const args = process.argv.slice(2);
  const onlyVideos = args.includes("--only-videos");
  const onlyImages = args.includes("--only-images");

  log.section("optimize-media.mjs");
  checkFfmpeg();
  const sharp = await checkSharp();

  // Crear directorios de output
  [CONFIG.outputVideos, CONFIG.outputImages].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  const manifest = { videos: [], images: [], generatedAt: new Date().toISOString() };

  // ── VIDEOS ──
  if (!onlyImages) {
    log.section("VIDEOS");
    const videoFiles = fs
      .readdirSync(CONFIG.videosDir)
      .filter((f) => CONFIG.video.extensions.includes(path.extname(f).toLowerCase()))
      .filter((f) => !f.startsWith("."));

    log.info(`Encontrados ${videoFiles.length} videos`);

    for (const file of videoFiles) {
      const inputPath = path.join(CONFIG.videosDir, file);
      const baseName = path.parse(file).name;
      const result = await processVideo(inputPath, baseName);
      manifest.videos.push({ ...result, name: baseName });
    }
  }

  // ── IMAGES ──
  if (!onlyVideos) {
    log.section("IMÁGENES");
    const imageFiles = fs
      .readdirSync(CONFIG.imagesDir)
      .filter((f) => CONFIG.image.extensions.includes(path.extname(f).toLowerCase()))
      .filter((f) => !f.startsWith("."));

    log.info(`Encontradas ${imageFiles.length} imágenes`);

    for (const file of imageFiles) {
      const inputPath = path.join(CONFIG.imagesDir, file);
      const baseName = path.parse(file).name;
      const result = await processImage(sharp, inputPath, baseName);
      manifest.images.push({ ...result, name: baseName });
    }
  }

  // ── MANIFEST ──
  fs.writeFileSync(CONFIG.manifestPath, JSON.stringify(manifest, null, 2));
  log.section("COMPLETADO");
  log.ok(`Manifest generado → public/media-manifest.json`);
  log.ok(`Videos: ${manifest.videos.length} | Imágenes: ${manifest.images.length}`);
};

main().catch((err) => {
  log.error(err.message);
  process.exit(1);
});