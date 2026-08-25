export function getVideoTrack(stream) {
  return stream?.getVideoTracks?.()?.[0] || null;
}

export async function applyCameraEnhancements(stream) {
  const track = getVideoTrack(stream);
  if (!track) {
    return { torchSupported: false, zoomSupported: false };
  }

  const caps = track.getCapabilities?.() || {};
  const advanced = [];

  if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
    advanced.push({ focusMode: 'continuous' });
  }

  if (advanced.length) {
    try {
      await track.applyConstraints({ advanced });
    } catch (_) {
      /* ignore unsupported combo */
    }
  }

  return {
    torchSupported: Boolean(caps.torch),
    zoomSupported: Boolean(caps.zoom),
    minZoom: caps.zoom?.min ?? 1,
    maxZoom: caps.zoom?.max ?? 1,
  };
}

export async function setTorchEnabled(stream, enabled) {
  const track = getVideoTrack(stream);
  if (!track) return false;
  try {
    await track.applyConstraints({ advanced: [{ torch: Boolean(enabled) }] });
    return true;
  } catch (_) {
    return false;
  }
}
