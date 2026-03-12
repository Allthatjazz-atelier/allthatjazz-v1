/**
 * useOptimizedMedia.js
 * 
 * Consume media-manifest.json y devuelve los paths correctos
 * según el dispositivo, conexión y soporte de formatos del browser.
 * 
 * Uso en el componente:
 *   const { getVideo, getImage, isLoaded } = useOptimizedMedia();
 *   const videoSources = getVideo("Allthatjazz cinematic©Feb26");
 *   // → { src: "/motion/optimized/Allthatjazz...mobile.webm", poster: "...", type: "video/webm" }
 */

import { useEffect, useState, useCallback } from "react";

// ─── Detección de capacidades del browser ──────────────────────────────────

const detectCapabilities = () => {
  if (typeof window === "undefined")
    return { isMobile: false, supportsWebM: false, slowConnection: false };

  const isMobile =
    window.innerWidth <= 768 ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // Detección real de soporte WebM/VP9
  const video = document.createElement("video");
  const supportsWebM =
    video.canPlayType('video/webm; codecs="vp9"') === "probably" ||
    video.canPlayType('video/webm; codecs="vp8"') !== "";

  // Network Information API (Chrome/Android)
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const slowConnection =
    connection?.effectiveType === "2g" ||
    connection?.effectiveType === "slow-2g" ||
    connection?.saveData === true;

  return { isMobile, supportsWebM, slowConnection };
};

// ─── Hook ──────────────────────────────────────────────────────────────────

export const useOptimizedMedia = () => {
  const [manifest, setManifest] = useState(null);
  const [capabilities, setCapabilities] = useState(detectCapabilities);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    fetch("/media-manifest.json")
      .then((r) => r.json())
      .then((data) => {
        setManifest(data);
        setIsLoaded(true);
      })
      .catch(() => {
        // Si no hay manifest (aún no se corrió el script), fallback a paths originales
        setIsLoaded(true);
      });

    const handleResize = () => setCapabilities(detectCapabilities());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /**
   * Devuelve las sources para un video, ordenadas por preferencia:
   * WebM primero (mejor compresión), MP4 como fallback.
   * 
   * @param {string} originalName - nombre del archivo sin extensión ni path
   * @returns {{ sources: Array<{src, type}>, poster: string, fallback: string }}
   */
  const getVideo = useCallback(
    (originalName) => {
      // Nombre limpio para buscar en el manifest
      const baseName = originalName
        .replace(/^.*[\\/]/, "") // quitar path
        .replace(/\.[^/.]+$/, ""); // quitar extensión

      const entry = manifest?.videos?.find((v) => v.name === baseName);

      if (!entry) {
        // Fallback: servir el original si no hay manifest todavía
        return {
          sources: [{ src: `/motion/${originalName}`, type: "video/mp4" }],
          poster: null,
          hasOptimized: false,
        };
      }

      const variant = capabilities.isMobile ? "mobile" : "desktop";

      // En conexiones lentas, forzar mobile aunque sea desktop
      const effectiveVariant =
        capabilities.slowConnection ? "mobile" : variant;

      const sources = [];

      // WebM primero (30-50% más ligero que H.264)
      if (capabilities.supportsWebM && entry[`${effectiveVariant}_webm`]) {
        sources.push({
          src: entry[`${effectiveVariant}_webm`],
          type: "video/webm",
        });
      }

      // MP4 H.264 como fallback universal (Safari, iOS, etc.)
      if (entry[`${effectiveVariant}_mp4`]) {
        sources.push({
          src: entry[`${effectiveVariant}_mp4`],
          type: "video/mp4",
        });
      }

      // Si no hay nada optimizado, usar el original
      if (sources.length === 0) {
        sources.push({ src: entry.original, type: "video/mp4" });
      }

      return {
        sources,
        poster: entry.poster || null,
        hasOptimized: sources.length > 0,
      };
    },
    [manifest, capabilities]
  );

  /**
   * Devuelve el path de imagen optimizado.
   * 
   * @param {string} originalName - nombre del archivo (ej: "story1.png")
   * @returns {{ src: string, fallback: string }}
   */
  const getImage = useCallback(
    (originalName) => {
      const baseName = originalName.replace(/\.[^/.]+$/, "");
      const entry = manifest?.images?.find((img) => img.name === baseName);

      if (!entry) {
        return { src: `/story/${originalName}`, fallback: null };
      }

      const variant = capabilities.isMobile ? "mobile" : "desktop";
      const effectiveVariant = capabilities.slowConnection ? "mobile" : variant;

      // WebP primero, JPEG fallback
      const src = entry[`${effectiveVariant}_webp`] || entry[`${effectiveVariant}_jpg`] || entry.original;
      const fallback = entry[`${effectiveVariant}_jpg`] || entry.original;

      return { src, fallback };
    },
    [manifest, capabilities]
  );

  return { getVideo, getImage, isLoaded, capabilities };
};