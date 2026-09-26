#!/usr/bin/env node
/**
 * optimize-media.mjs
 *
 * Pipeline de agencia para texturas WebGL: masters en /public/new-assets,
 * derivados por dispositivo en /public/media/optimized.
 *
 *   node optimize-media.mjs
 *   node optimize-media.mjs --only-images
 *   node optimize-media.mjs --only-videos
 *   node optimize-media.mjs --force
 *
 * Imágenes (mobile 1080 / desktop 1920, long-edge, sin upscale):
 *   .avif  .webp  .jpg
 *
 * Vídeos (mobile 1080 / desktop 1920, long-edge, sin upscale, sin audio):
 *   .mp4  H.264  +faststart
 *   .webm VP9
 *   .poster.jpg
 *   .thumb.mp4   H.264 480  (rejilla densa y campo de la galaxia)
 *   .micro.{avif,webp,jpg}  256  (rejilla a 4 columnas en movil)
 *   .thumb.{avif,webp,jpg}  480  (rejilla a 3 y 2 columnas en movil)
 *   .poster.thumb.jpg  384
 *
 * Escribe /public/media-manifest.json para useOptimizedMedia.
 */

import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONFIG = {
  sourceDir: path.join(__dirname, "public", "new-assets"),
  outputImages: path.join(__dirname, "public", "media", "optimized", "images"),
  outputVideos: path.join(__dirname, "public", "media", "optimized", "videos"),
  manifestPath: path.join(__dirname, "public", "media-manifest.json"),
  publicBase: "/media/optimized",

  video: {
    mobile: {
      maxEdge: 1080,
      mp4: { crf: 23, preset: "fast", profile: "high", level: "4.1" },
      webm: { crf: 33, cpuUsed: 4 },
    },
    thumb: {
      maxEdge: 480,
      mp4: { crf: 28, preset: "veryfast", profile: "high", level: "4.0" },
    },
    desktop: {
      maxEdge: 1920,
      mp4: { crf: 20, preset: "fast", profile: "high", level: "4.1" },
      webm: { crf: 29, cpuUsed: 4 },
    },
    extensions: [".mp4", ".mov", ".webm", ".avi", ".mkv", ".m4v"],
  },

  // Los dos escalones pequenos son para la rejilla densa. Sin ellos el
  // navegador no tiene candidato por debajo de 1080 y sirve el derivado grande
  // en una celda de 118 px: ~88 KB y ~0,9 MP de decode por pieza, cien veces.
  // El `srcSet` de useOptimizedMedia ya los pedia (IMAGE_DERIVATIVES) desde
  // antes de que existieran.
  image: {
    micro: {
      maxEdge: 256,
      avifQuality: 58,
      webpQuality: 82,
      jpgQuality: 84,
      // 4:4:4 en los escalones pequenos: el fichero pesa poco de todas formas y
      // a 256 px el submuestreo de croma se lee como color sucio en los bordes.
      chroma: "4:4:4",
    },
    thumb: {
      maxEdge: 480,
      avifQuality: 55,
      webpQuality: 82,
      jpgQuality: 84,
      chroma: "4:4:4",
    },
    mobile: {
      maxEdge: 1080,
      avifQuality: 52,
      webpQuality: 80,
      jpgQuality: 82,
      chroma: "4:2:0",
    },
    desktop: {
      maxEdge: 1920,
      avifQuality: 55,
      webpQuality: 86,
      jpgQuality: 88,
      chroma: "4:4:4",
    },
    extensions: [".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".heic", ".heif"],
  },

  imageConcurrency: 3,
};

/** Escalones de imagen, de menor a mayor. El orden es el del `srcSet`. */
const IMAGE_VARIANTS = ["micro", "thumb", "mobile", "desktop"];

const log = {
  info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  ok: (msg) => console.log(`\x1b[32m[OK]\x1b[0m ${msg}`),
  skip: (msg) => console.log(`\x1b[33m[SKIP]\x1b[0m ${msg}`),
  error: (msg) => console.error(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  section: (msg) => console.log(`\n\x1b[1m\x1b[35m═══ ${msg} ═══\x1b[0m\n`),
};

const FORCE = process.argv.includes("--force");

const slugify = (name) =>
  name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

const checkFfmpeg = () => {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    execSync("ffprobe -version", { stdio: "ignore" });
    return true;
  } catch {
    log.error("FFmpeg no encontrado. Instálalo con: brew install ffmpeg");
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
      else reject(new Error(errOutput.slice(-800)));
    });
  });

const listSourceFiles = (extensions) =>
  fs
    .readdirSync(CONFIG.sourceDir)
    .filter((f) => extensions.includes(path.extname(f).toLowerCase()))
    .filter((f) => !f.startsWith("."))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

const mapLimit = async (items, limit, fn) => {
  const ret = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) || 1 }, async () => {
    while (i < items.length) {
      const idx = i++;
      ret[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return ret;
};

const shouldWrite = (outputPath) => FORCE || !fs.existsSync(outputPath);

const publicPath = (kind, filename) =>
  `${CONFIG.publicBase}/${kind}/${filename}`;

// ─── VIDEO ──────────────────────────────────────────────────────────────────

const scaleFilter = (maxEdge) =>
  `scale='min(${maxEdge},iw)':'min(${maxEdge},ih)':force_original_aspect_ratio=decrease:flags=lanczos,scale=trunc(iw/2)*2:trunc(ih/2)*2`;

const optimizeVideoVariant = async (inputPath, outputPath, variant, format) => {
  if (!shouldWrite(outputPath)) {
    log.skip(`Ya existe: ${path.basename(outputPath)}`);
    return false;
  }

  const { maxEdge } = CONFIG.video[variant];
  const filter = scaleFilter(maxEdge);
  const cfg = CONFIG.video[variant][format];

  if (format === "mp4") {
    await runFfmpeg([
      "-y",
      "-i", inputPath,
      "-vf", filter,
      "-c:v", "libx264",
      "-preset", cfg.preset,
      "-crf", String(cfg.crf),
      "-profile:v", cfg.profile,
      "-level", cfg.level,
      "-pix_fmt", "yuv420p",
      "-color_primaries", "bt709",
      "-color_trc", "bt709",
      "-colorspace", "bt709",
      "-movflags", "+faststart",
      "-an",
      outputPath,
    ]);
    return true;
  }

  await runFfmpeg([
    "-y",
    "-i", inputPath,
    "-vf", filter,
    "-c:v", "libvpx-vp9",
    "-crf", String(cfg.crf),
    "-b:v", "0",
    "-row-mt", "1",
    "-deadline", "good",
    "-cpu-used", String(cfg.cpuUsed),
    "-tile-columns", "2",
    "-frame-parallel", "1",
    "-auto-alt-ref", "1",
    "-lag-in-frames", "16",
    "-pix_fmt", "yuv420p",
    "-an",
    outputPath,
  ]);
  return true;
};

const extractPoster = async (inputPath, outputPath) => {
  if (!shouldWrite(outputPath)) {
    log.skip(`Poster ya existe: ${path.basename(outputPath)}`);
    return;
  }
  await runFfmpeg([
    "-y",
    "-ss", "0.8",
    "-i", inputPath,
    "-frames:v", "1",
    "-q:v", "3",
    "-f", "image2",
    outputPath,
  ]);
};

const extractPosterThumb = async (inputPath, outputPath) => {
  if (!shouldWrite(outputPath)) {
    log.skip(`Poster thumb ya existe: ${path.basename(outputPath)}`);
    return;
  }
  await runFfmpeg([
    "-y",
    "-i", inputPath,
    "-vf", scaleFilter(384),
    "-frames:v", "1",
    "-q:v", "4",
    "-f", "image2",
    outputPath,
  ]);
};

const processVideo = async (sharp, inputPath, slug) => {
  const out = CONFIG.outputVideos;
  const result = {
    original: `/new-assets/${path.basename(inputPath)}`,
    name: slug,
    aliases: [path.parse(inputPath).name],
  };

  try {
    log.info(`Procesando video: ${path.basename(inputPath)} → ${slug}`);

    for (const variant of ["mobile", "desktop"]) {
      for (const format of ["mp4", "webm"]) {
        const filename = `${slug}.${variant}.${format}`;
        const outputPath = path.join(out, filename);
        try {
          const created = await optimizeVideoVariant(inputPath, outputPath, variant, format);
          if (created || fs.existsSync(outputPath)) {
            if (created) log.ok(`${variant}.${format}: ${formatReduction(inputPath, outputPath)}`);
            result[`${variant}_${format}`] = publicPath("videos", filename);
          }
        } catch (err) {
          log.error(`${slug} ${variant}.${format}: ${err.message}`);
        }
      }
    }

    const posterName = `${slug}.poster.jpg`;
    const posterPath = path.join(out, posterName);
    const posterSrc =
      (result.mobile_mp4 && path.join(out, `${slug}.mobile.mp4`)) || inputPath;
    if (fs.existsSync(posterSrc)) {
      await extractPoster(posterSrc, posterPath);
      if (fs.existsSync(posterPath)) {
        log.ok(`poster: ${getFileSize(posterPath)}`);
        result.poster = publicPath("videos", posterName);
        // Las dimensiones salen del poster ya extraido, no de ffprobe: es el
        // fichero que la rejilla pinta mientras el video no corre, asi que es
        // el que manda la proporcion de la celda y los descriptores del
        // `srcSet`. Sin esto la rejilla caia en FALLBACK_AR (0.8) y las piezas
        // verticales de 9:16 se recortaban por arriba y por abajo.
        try {
          const pm = await sharp(posterPath).metadata();
          if (pm.width && pm.height) {
            result.width = pm.width;
            result.height = pm.height;
          }
        } catch (err) {
          log.skip(`${slug}: sin dimensiones de poster (${err.message})`);
        }
        const thumbPosterName = `${slug}.poster.thumb.jpg`;
        const thumbPosterPath = path.join(out, thumbPosterName);
        await extractPosterThumb(posterPath, thumbPosterPath);
        if (fs.existsSync(thumbPosterPath)) {
          log.ok(`poster thumb: ${getFileSize(thumbPosterPath)}`);
          result.poster_thumb = publicPath("videos", thumbPosterName);
          try {
            const tm = await sharp(thumbPosterPath).metadata();
            if (tm.width) result.poster_thumb_width = tm.width;
          } catch {
            /* el descriptor cae al calculado */
          }
        }
      }
    }

    const thumbName = `${slug}.thumb.mp4`;
    const thumbPath = path.join(out, thumbName);
    const thumbInput = fs.existsSync(path.join(out, `${slug}.mobile.mp4`))
      ? path.join(out, `${slug}.mobile.mp4`)
      : inputPath;
    try {
      const created = await optimizeVideoVariant(thumbInput, thumbPath, "thumb", "mp4");
      if (created || fs.existsSync(thumbPath)) {
        if (created) log.ok(`thumb.mp4: ${formatReduction(thumbInput, thumbPath)}`);
        result.thumb_mp4 = publicPath("videos", thumbName);
      }
    } catch (err) {
      log.error(`${slug} thumb.mp4: ${err.message}`);
    }
  } catch (err) {
    log.error(`Error procesando ${path.basename(inputPath)}: ${err.message}`);
  }

  return result;
};

// ─── IMAGE ──────────────────────────────────────────────────────────────────

const decodeHeicFallback = (inputPath) => {
  const tmp = path.join(
    CONFIG.outputImages,
    `._heic_${slugify(path.parse(inputPath).name)}.jpg`
  );
  execSync(`sips -s format jpeg ${JSON.stringify(inputPath)} --out ${JSON.stringify(tmp)}`, {
    stdio: "ignore",
  });
  return tmp;
};

const processImage = async (sharp, inputPath, slug) => {
  const out = CONFIG.outputImages;
  const result = {
    original: `/new-assets/${path.basename(inputPath)}`,
    name: slug,
    aliases: [path.parse(inputPath).name],
  };
  let decodedPath = inputPath;
  let tmpHeic = null;

  try {
    log.info(`Procesando imagen: ${path.basename(inputPath)} → ${slug}`);
    const ext = path.extname(inputPath).toLowerCase();
    if ([".heic", ".heif"].includes(ext)) {
      log.info(`HEIC via sips: ${path.basename(inputPath)}`);
      tmpHeic = decodeHeicFallback(inputPath);
      decodedPath = tmpHeic;
    }
    const meta = await sharp(decodedPath, { failOn: "none" }).rotate().metadata();
    result.hasAlpha = Boolean(meta.hasAlpha);
    result.width = meta.width;
    result.height = meta.height;

    // Aviso de carga: un color y un LQIP diminuto que viajan DENTRO del
    // manifiesto, asi que estan en pantalla antes de que se pida el primer
    // derivado. Los dos salen de una sola reduccion a 64 px: volver a leer el
    // master es lo unico caro, y asi se paga una vez y no tres.
    try {
      const small = await sharp(decodedPath, { failOn: "none" })
        .rotate()
        .resize(64, 64, { fit: "inside" })
        .toBuffer();
      // El dominante de la reduccion es el color que se percibe, no el pixel
      // mas repetido del master.
      //
      // La decision va por `isOpaque`, no por `hasAlpha`: casi todos los PNG del
      // archivo traen canal alfa y lo tienen entero a 255, asi que `hasAlpha`
      // habria dejado sin color 39 de 43 piezas. Cuando la transparencia es de
      // verdad no se publica color —el histograma cuenta los pixeles
      // transparentes y devuelve el de un fondo que no se va a ver— y esas caen
      // en --atj-surface con el LQIP, que si conserva su alfa.
      const stats = await sharp(small).stats();
      if (stats.isOpaque) {
        const { dominant } = stats;
        result.color = `#${[dominant.r, dominant.g, dominant.b]
          .map((c) => c.toString(16).padStart(2, "0"))
          .join("")}`;
      }
      const lqip = await sharp(small)
        .resize(20, 20, { fit: "inside" })
        .webp({ quality: 45, alphaQuality: 60 })
        .toBuffer();
      result.lqip = `data:image/webp;base64,${lqip.toString("base64")}`;
    } catch (err) {
      log.skip(`${slug}: sin placeholder (${err.message})`);
    }

    for (const [variant, cfg] of IMAGE_VARIANTS.map((v) => [v, CONFIG.image[v]])) {
      const base = sharp(decodedPath, { failOn: "none", sequentialRead: true })
        .rotate()
        .resize(cfg.maxEdge, cfg.maxEdge, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .toColorspace("srgb");

      const avifName = `${slug}.${variant}.avif`;
      const avifPath = path.join(out, avifName);
      if (shouldWrite(avifPath)) {
        await base
          .clone()
          .avif({
            quality: cfg.avifQuality,
            effort: 4,
            chromaSubsampling: cfg.chroma,
          })
          .toFile(avifPath);
        log.ok(`${variant}.avif: ${formatReduction(inputPath, avifPath)}`);
      } else {
        log.skip(`Ya existe: ${avifName}`);
      }
      result[`${variant}_avif`] = publicPath("images", avifName);

      const webpName = `${slug}.${variant}.webp`;
      const webpPath = path.join(out, webpName);
      if (shouldWrite(webpPath)) {
        await base
          .clone()
          .webp({
            quality: cfg.webpQuality,
            effort: 5,
            smartSubsample: cfg.chroma === "4:2:0",
          })
          .toFile(webpPath);
        log.ok(`${variant}.webp: ${formatReduction(inputPath, webpPath)}`);
      } else {
        log.skip(`Ya existe: ${webpName}`);
      }
      result[`${variant}_webp`] = publicPath("images", webpName);

      const jpgName = `${slug}.${variant}.jpg`;
      const jpgPath = path.join(out, jpgName);
      if (shouldWrite(jpgPath)) {
        const jpgPipeline = result.hasAlpha
          ? base.clone().flatten({ background: "#ffffff" })
          : base.clone();
        await jpgPipeline
          .jpeg({
            quality: cfg.jpgQuality,
            progressive: true,
            mozjpeg: true,
            chromaSubsampling: cfg.chroma,
          })
          .toFile(jpgPath);
        log.ok(`${variant}.jpg: ${formatReduction(inputPath, jpgPath)}`);
      } else {
        log.skip(`Ya existe: ${jpgName}`);
      }
      result[`${variant}_jpg`] = publicPath("images", jpgName);
    }

    // sharp().metadata() devuelve el sensor sin la orientación del HEIC.
    // El JPEG ya sale girado: si no, la rejilla reserva una caja apaisada y cover recorta.
    const mobileJpg = path.join(out, `${slug}.mobile.jpg`);
    if (result.width && result.height && fs.existsSync(mobileJpg)) {
      const file = await sharp(mobileJpg).metadata();
      if (file.width && file.height) {
        const fileAR = file.width / file.height;
        const metaAR = result.width / result.height;
        if (Math.abs(fileAR - metaAR) > 0.02 && Math.abs(fileAR - 1 / metaAR) < 0.02) {
          const w = result.width;
          result.width = result.height;
          result.height = w;
        }
      }
    }
  } catch (err) {
    log.error(`Error procesando ${path.basename(inputPath)}: ${err.message}`);
  } finally {
    if (tmpHeic && fs.existsSync(tmpHeic)) fs.unlinkSync(tmpHeic);
  }

  return result;
};

// ─── MAIN ───────────────────────────────────────────────────────────────────

const main = async () => {
  const args = process.argv.slice(2);
  const onlyVideos = args.includes("--only-videos");
  const onlyImages = args.includes("--only-images");

  log.section("optimize-media · new-assets");
  if (FORCE) log.info("Modo --force: se regeneran todos los derivados");
  checkFfmpeg();
  const sharp = await checkSharp();

  [CONFIG.outputVideos, CONFIG.outputImages].forEach((dir) => {
    fs.mkdirSync(dir, { recursive: true });
  });

  const existing = fs.existsSync(CONFIG.manifestPath)
    ? JSON.parse(fs.readFileSync(CONFIG.manifestPath, "utf-8"))
    : { videos: [], images: [] };

  const manifest = {
    source: "new-assets",
    videos: onlyImages ? existing.videos || [] : [],
    images: onlyVideos ? existing.images || [] : [],
    generatedAt: new Date().toISOString(),
  };

  if (!onlyImages) {
    log.section("VÍDEOS");
    const videoFiles = listSourceFiles(CONFIG.video.extensions);
    log.info(`Encontrados ${videoFiles.length} videos`);
    const pendingStubs = videoFiles.map((file) => ({
      original: `/new-assets/${file}`,
      name: slugify(path.parse(file).name),
      aliases: [path.parse(file).name],
    }));
    for (const file of videoFiles) {
      const inputPath = path.join(CONFIG.sourceDir, file);
      const slug = slugify(path.parse(file).name);
      const result = await processVideo(sharp, inputPath, slug);
      manifest.videos.push(result);
      const remaining = pendingStubs.filter(
        (s) => !manifest.videos.some((v) => v.name === s.name)
      );
      fs.writeFileSync(
        CONFIG.manifestPath,
        JSON.stringify({ ...manifest, videos: [...manifest.videos, ...remaining] }, null, 2)
      );
    }
  }

  if (!onlyVideos) {
    log.section("IMÁGENES");
    const imageFiles = listSourceFiles(CONFIG.image.extensions);
    log.info(`Encontradas ${imageFiles.length} imágenes`);
    const results = await mapLimit(imageFiles, CONFIG.imageConcurrency, async (file) => {
      const inputPath = path.join(CONFIG.sourceDir, file);
      const slug = slugify(path.parse(file).name);
      return processImage(sharp, inputPath, slug);
    });
    manifest.images.push(...results);
  }

  fs.writeFileSync(CONFIG.manifestPath, JSON.stringify(manifest, null, 2));
  log.section("COMPLETADO");
  log.ok(`Manifest → public/media-manifest.json`);
  log.ok(`Videos: ${manifest.videos.length} | Imágenes: ${manifest.images.length}`);
};

main().catch((err) => {
  log.error(err.message);
  process.exit(1);
});
