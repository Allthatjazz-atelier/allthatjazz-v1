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
        src: pickPlayableSrc(sources),
        hasOptimized: Boolean(entry.mobile_mp4 || entry.desktop_mp4),
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

  const videoIds = useMemo(
    () => (manifest?.videos ?? []).map((v) => v.name),
    [manifest]
  );

  const imageIds = useMemo(
    () => (manifest?.images ?? []).map((v) => v.name),
    [manifest]
  );

  return { getVideo, getImage, isLoaded, capabilities, videoIds, imageIds };
};
