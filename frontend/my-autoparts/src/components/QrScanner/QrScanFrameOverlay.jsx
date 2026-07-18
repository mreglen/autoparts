import React from 'react';
import './qrScanFrame.css';

/**
 * Banking-style QR frame: dark cutout + corner brackets that follow `frame`.
 */
export default function QrScanFrameOverlay({ frame, locked = false, hint = 'Наведите на QR-код' }) {
  const ready = frame && frame.w > 0 && frame.h > 0;
  const isLocked = locked || frame?.locked;

  return (
    <div className="qr-scan-overlay pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
      {ready ? (
        <div
          className={`qr-scan-frame ${isLocked ? 'qr-scan-frame--locked' : ''}`}
          style={{
            left: frame.x,
            top: frame.y,
            width: frame.w,
            height: frame.h,
          }}
        >
          <span className="qr-scan-corner qr-scan-corner--tl" />
          <span className="qr-scan-corner qr-scan-corner--tr" />
          <span className="qr-scan-corner qr-scan-corner--bl" />
          <span className="qr-scan-corner qr-scan-corner--br" />
        </div>
      ) : null}

      {hint && !isLocked ? (
        <div className="absolute inset-x-0 bottom-3 flex justify-center px-3">
          <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] font-medium text-white/95 backdrop-blur-sm">
            {hint}
          </span>
        </div>
      ) : null}
    </div>
  );
}
