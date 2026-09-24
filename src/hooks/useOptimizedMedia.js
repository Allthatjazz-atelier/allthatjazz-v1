/**
 * useOptimizedMedia.js
 *
 * Consume /media-manifest.json y resuelve el derivado correcto según
 * dispositivo, conexión y soporte de formatos del browser.
 *
 *   const { getVideo, getImage, isLoaded } = useOptimizedMedia();
 *   const img = getImage("atj-webcontent-001");
 *   const vid = getVideo("johnny-carretes-pr-reel");
 */

import { useEffect, useState, useCallback, useMemo } from "react";

const AVIF_PROBE =
  "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAADAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKBzgADlAgI0yGh0A=";

const WEBP_PROBE =
  "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";

const probeFormat = (src) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });

const detectSync = () => {
  if (typeof window === "undefined") {
    return {
      isMobile: false,
      supportsWebM: false,
      supportsAvif: false,
      supportsWebp: true,
      slowConnection: false,
    };
  }

  const isMobile =
    window.innerWidth <= 768 ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const video = document.createElement("video");
  const supportsWebM =
    video.canPlayType('video/webm; codecs="vp9"') === "probably" ||
    video.canPlayType('video/webm; codecs="vp8"') !== "";

  const connection =
    navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const slowConnection =
    connection?.effectiveType === "2g" ||
    connection?.effectiveType === "slow-2g" ||
    connection?.saveData === true;

  return {
    isMobile,
    supportsWebM,
    supportsAvif: false,
    supportsWebp: true,
    slowConnection,
  };
};

const detectAsyncFormats = async () => {
  if (typeof window === "undefined") {
    return { supportsAvif: false, supportsWebp: true };
  }
  const [supportsAvif, supportsWebp] = await Promise.all([
    probeFormat(AVIF_PROBE),
    probeFormat(WEBP_PROBE),
  ]);
  return { supportsAvif, supportsWebp };
};

const cleanName = (originalName) =>
  originalName
    .replace(/^.*[\\/]/, "")
    .replace(/\.[^/.]+$/, "");

const isHeicPath = (p) => /\.hei[cf]$/i.test(p || "");

/**
 * Derivados de imagen, de menor a mayor. `maxEdge` es el mismo que aplica
 * optimize-media.mjs (fit: inside, sin upscale), así que el ancho real de cada
 * fichero se puede calcular sin medirlo.
 */
const IMAGE_DERIVATIVES = [
  { key: "thumb", maxEdge: 480 },
  { key: "mobile", maxEdge: 1080 },
  { key: "desktop", maxEdge: 1920 },
];

const derivativeWidth = (w, h, maxEdge) => {
  if (!w || !h) return null;
  return Math.round(w * Math.min(1, maxEdge / Math.max(w, h)));
};

const findEntry = (list, originalName) => {
  if (!list?.length) return null;
  const baseName = cleanName(originalName);
  return (
    list.find((item) => item.name === baseName) ||
    list.find((item) => item.aliases?.includes(baseName)) ||
    list.find((item) => item.aliases?.includes(originalName)) ||
    null
  );
};

export const pickPlayableSrc = (sources) => {
  if (!sources?.length) return null;
  if (typeof document === "undefined") return sources[0]?.src || null;
  const video = document.createElement("video");
  return (sources.find((s) => video.canPlayType(s.type) !== "") || sources[0])?.src || null;
};

export const useOptimizedMedia = () => {
  const [manifest, setManifest] = useState(null);
  const [capabilities, setCapabilities] = useState(detectSync);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const formats = await detectAsyncFormats();
      if (cancelled) return;
      setCapabilities({ ...detectSync(), ...formats });

      try {
        const data = await fetch("/media-manifest.json").then((r) => r.json());
        if (!cancelled) {
          setManifest(data);
          setIsLoaded(true);
        }
      } catch {
        if (!cancelled) setIsLoaded(true);
      }
    };

    boot();

    const handleResize = () => {
      setCapabilities((prev) => ({ ...prev, ...detectSync(), supportsAvif: prev.supportsAvif, supportsWebp: prev.supportsWebp }));
    };
    window.addEventListener("resize", handleResize);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const variantFor = useCallback(() => {
    const variant = capabilities.isMobile ? "mobile" : "desktop";
    return capabilities.slowConnection ? "mobile" : variant;
  }, [capabilities]);

  const getVideo = useCallback(
    (originalName) => {
      const entry = findEntry(manifest?.videos, originalName);

      if (!entry) {
        const fallbackName = originalName.match(/\.(mp4|mov|webm)$/i)
          ? originalName
          : `${originalName}.mp4`;
        return {
          sources: [{ src: `/new-assets/${fallbackName}`, type: "video/mp4" }],
          poster: null,
          src: `/new-assets/${fallbackName}`,
          hasOptimized: false,
        };
      }

      const effectiveVariant = variantFor();
      const sources = [];

      if (capabilities.supportsWebM && entry[`${effectiveVariant}_webm`]) {
        sources.push({
          src: entry[`${effectiveVariant}_webm`],
          type: "video/webm",
        });
      }

      if (entry[`${effectiveVariant}_mp4`]) {
        sources.push({
          src: entry[`${effectiveVariant}_mp4`],
          type: "video/mp4",
        });
      }

      if (sources.length === 0 && entry.original) {
        sources.push({ src: entry.original, type: "video/mp4" });
      }

      return {
        sources,
        poster: entry.poster || null,
        posterThumb: entry.poster_thumb || null,
        // Copia de 480 px para rejillas: varias reproduciéndose a la vez a
        // 1080 son varios decodificadores de más para nada.
        thumbSrc: entry.thumb_mp4 || null,
        src: pickPlayableSrc(sources),
        hasOptimized: Boolean(entry.mobile_mp4 || entry.desktop_mp4),
        // Del manifiesto (ffprobe sobre el póster): permite reservar el hueco
        // con la proporción correcta antes de cargar nada.
        width: entry.width || null,
        height: entry.height || null,
      };
    },
    [manifest, capabilities, variantFor]
  );

  const getImage = useCallback(
    (originalName) => {
      const entry = findEntry(manifest?.images, originalName);

      if (!entry) {
        const withExt = /\.[a-z0-9]+$/i.test(originalName)
          ? originalName
          : `${originalName}.png`;
        // Chrome/Firefox no decodifican HEIC: sin derivado, no hay src usable.
        if (isHeicPath(withExt)) return { src: null, fallback: null };
        return { src: `/new-assets/${withExt}`, fallback: null };
      }

      const effectiveVariant = variantFor();
      const avif = entry[`${effectiveVariant}_avif`];
      const webp = entry[`${effectiveVariant}_webp`];
      const jpg = entry[`${effectiveVariant}_jpg`];
      const original = isHeicPath(entry.original) ? null : entry.original;

      // HEIC/HEIF: Chrome sube el AVIF (mismo contenedor) por texImage3D y falla
      // con FLIP_Y. JPEG es el único derivado fiable para WebGL.
      if (isHeicPath(entry.original)) {
        return { src: jpg || webp || null, fallback: jpg || null };
      }

      let src = jpg || webp || avif || original;
      if (capabilities.supportsWebp && webp) src = webp;
      if (capabilities.supportsAvif && avif) src = avif;

      return {
        src,
        fallback: jpg || original,
      };
    },
    [manifest, capabilities, variantFor]
  );

  /**
   * Juego de derivados para `srcset`. Lo usa la rejilla: la misma pieza se
   * dibuja a 175 px en 8 columnas y a 583 en 2, y con `srcset` + `sizes` el
   * navegador elige el fichero por sí mismo —y vuelve a elegir al cambiar la
   * densidad— en vez de servir siempre el grande y escalarlo.
   */
  const getImageSet = useCallback(
    (originalName) => {
      const entry = findEntry(manifest?.images, originalName);
      if (!entry) {
        const single = getImage(originalName);
        return { src: single.src, srcSet: null, width: null, height: null, heic: false };
      }

      // HEIC: el AVIF comparte contenedor y Chrome lo trata como imagen HEIF;
      // el JPEG es el único derivado fiable. Misma regla que en `getImage`.
      const heic = isHeicPath(entry.original);
      const format = heic
        ? "jpg"
        : (capabilities.supportsAvif && "avif") || (capabilities.supportsWebp && "webp") || "jpg";

      const seen = new Set();
      const candidates = [];
      for (const { key, maxEdge } of IMAGE_DERIVATIVES) {
        const url = entry[`${key}_${format}`] || entry[`${key}_jpg`];
        if (!url) continue;
        const w = derivativeWidth(entry.width, entry.height, maxEdge);
        // Un master pequeño produce derivados idénticos: repetirlos en el
        // srcset solo confunde al selector del navegador.
        if (!w || seen.has(w)) continue;
        seen.add(w);
        candidates.push({ url, w });
      }
      if (!candidates.length) {
        const single = getImage(originalName);
        return { src: single?.src || null, srcSet: null, width: entry.width, height: entry.height, heic };
      }

      return {
        src: candidates[0].url,
        srcSet: candidates.map((c) => `${c.url} ${c.w}w`).join(", "),
        width: entry.width || null,
        height: entry.height || null,
        heic,
      };
    },
    [manifest, capabilities, getImage]
  );

  const videoIds = useMemo(
    () => (manifest?.videos ?? []).map((v) => v.name),
    [manifest]
  );

  const imageIds = useMemo(
    () => (manifest?.images ?? []).map((v) => v.name),
    [manifest]
  );

  return { getVideo, getImage, getImageSet, isLoaded, capabilities, videoIds, imageIds };
};
