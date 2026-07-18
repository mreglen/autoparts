import { useEffect, useRef, useState } from 'react';

const DEFAULT_RATIO = 0.62;
const LOST_MS = 420;
const TRACK_INTERVAL_MS = 80;
const PADDING = 14;

function createDetector() {
  if (typeof window === 'undefined' || typeof window.BarcodeDetector !== 'function') {
    return null;
  }
  try {
    return new window.BarcodeDetector({ formats: ['qr_code'] });
  } catch (_) {
    return null;
  }
}

function findVideo(container) {
  if (!container) return null;
  return container.querySelector('video') || null;
}

/** Map video intrinsic coords → container display coords (object-fit: cover). */
function mapVideoBoxToContainer(video, container, box) {
  const cRect = container.getBoundingClientRect();
  const vRect = video.getBoundingClientRect();
  const vw = video.videoWidth || 0;
  const vh = video.videoHeight || 0;
  if (!vw || !vh || !cRect.width || !cRect.height) return null;

  const videoRatio = vw / vh;
  const elemRatio = vRect.width / vRect.height;
  let scale;
  let cropX = 0;
  let cropY = 0;

  if (videoRatio > elemRatio) {
    scale = vRect.height / vh;
    cropX = (vw - vRect.width / scale) / 2;
  } else {
    scale = vRect.width / vw;
    cropY = (vh - vRect.height / scale) / 2;
  }

  const offsetX = vRect.left - cRect.left;
  const offsetY = vRect.top - cRect.top;

  return {
    x: (box.x - cropX) * scale + offsetX,
    y: (box.y - cropY) * scale + offsetY,
    w: box.width * scale,
    h: box.height * scale,
  };
}

function defaultFrame(container) {
  if (!container) {
    return { x: 0, y: 0, w: 0, h: 0, locked: false };
  }
  const { clientWidth: w, clientHeight: h } = container;
  if (!w || !h) {
    return { x: 0, y: 0, w: 0, h: 0, locked: false };
  }
  const size = Math.min(w, h) * DEFAULT_RATIO;
  return {
    x: (w - size) / 2,
    y: (h - size) / 2,
    w: size,
    h: size,
    locked: false,
  };
}

function padAndClamp(mapped, container) {
  const maxW = container.clientWidth;
  const maxH = container.clientHeight;
  let x = mapped.x - PADDING;
  let y = mapped.y - PADDING;
  let w = mapped.w + PADDING * 2;
  let h = mapped.h + PADDING * 2;

  // Keep square-ish frame like banking apps
  const side = Math.max(w, h);
  x -= (side - w) / 2;
  y -= (side - h) / 2;
  w = side;
  h = side;

  x = Math.max(8, Math.min(x, maxW - w - 8));
  y = Math.max(8, Math.min(y, maxH - h - 8));
  w = Math.min(w, maxW - 16);
  h = Math.min(h, maxH - 16);

  return { x, y, w, h, locked: true };
}

/**
 * Tracks QR position inside a scanner host and drives a Sber-like frame.
 * @param {{ active: boolean, containerRef: React.RefObject<HTMLElement|null>, locked?: boolean }} opts
 */
export function useQrFrameTracker({ active, containerRef, locked = false }) {
  const [frame, setFrame] = useState(() => ({ x: 0, y: 0, w: 0, h: 0, locked: false }));
  const detectorRef = useRef(null);
  const lastSeenRef = useRef(0);
  const trackingRef = useRef(false);
  const rafRef = useRef(0);
  const lastTickRef = useRef(0);

  useEffect(() => {
    detectorRef.current = createDetector();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) {
      setFrame({ x: 0, y: 0, w: 0, h: 0, locked: false });
      return undefined;
    }

    setFrame(defaultFrame(container));

    let cancelled = false;
    let detecting = false;
    trackingRef.current = true;

    const tick = async (now) => {
      if (cancelled) return;
      rafRef.current = requestAnimationFrame(tick);

      if (now - lastTickRef.current < TRACK_INTERVAL_MS) return;
      lastTickRef.current = now;

      if (locked || detecting) return;

      const video = findVideo(container);
      const detector = detectorRef.current;
      if (!video || video.readyState < 2 || !detector) {
        if (!trackingRef.current) {
          setFrame(defaultFrame(container));
        }
        return;
      }

      detecting = true;
      try {
        const codes = await detector.detect(video);
        if (cancelled) return;

        const qr = codes?.[0];
        if (qr?.boundingBox) {
          const mapped = mapVideoBoxToContainer(video, container, qr.boundingBox);
          if (mapped && mapped.w > 12 && mapped.h > 12) {
            lastSeenRef.current = now;
            trackingRef.current = true;
            setFrame(padAndClamp(mapped, container));
            return;
          }
        }
      } catch (_) {
        /* detector may fail on some frames */
      } finally {
        detecting = false;
      }

      if (trackingRef.current && now - lastSeenRef.current > LOST_MS) {
        trackingRef.current = false;
        setFrame(defaultFrame(container));
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    const onResize = () => {
      if (!trackingRef.current) {
        setFrame(defaultFrame(container));
      }
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, [active, containerRef, locked]);

  useEffect(() => {
    if (!locked) return;
    setFrame((prev) => (prev.w ? { ...prev, locked: true } : prev));
  }, [locked]);

  return frame;
}

/** Shared html5-qrcode config: full viewfinder, custom overlay draws the frame. */
export const QR_SCAN_CAMERA_CONFIG = {
  fps: 10,
};

/** Hide library’s fixed shaded square — we draw our own. */
export const QR_SCAN_HOST_CLASS = 'qr-scan-host';
