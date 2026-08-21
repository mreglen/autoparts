import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_USER_ZOOM = 1;
const MAX_USER_ZOOM = 4;

function isInteractiveTarget(target) {
  return Boolean(
    target?.closest?.('input, textarea, button, a, select, label, [role="button"], [contenteditable="true"]'),
  );
}

function touchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

function touchCenter(touches, rect) {
  const x = (touches[0].clientX + touches[1].clientX) / 2 - rect.left;
  const y = (touches[0].clientY + touches[1].clientY) / 2 - rect.top;
  return { x, y };
}

function clampPan(nextPan, viewport, contentWidth, contentHeight) {
  if (!viewport.width || !viewport.height) return nextPan;

  let x = nextPan.x;
  let y = nextPan.y;

  if (contentWidth <= viewport.width) {
    x = (viewport.width - contentWidth) / 2;
  } else {
    const minX = viewport.width - contentWidth;
    x = Math.max(minX, Math.min(0, x));
  }

  if (contentHeight <= viewport.height) {
    y = Math.max(0, (viewport.height - contentHeight) / 2);
  } else {
    const minY = viewport.height - contentHeight;
    y = Math.max(minY, Math.min(0, y));
  }

  return { x, y };
}

/**
 * Предпросмотр документа: уменьшение под экран, pinch/ctrl+колёсико для зума,
 * перетаскивание мышью (любая кнопка) и пальцем. Печать/PDF не затрагивает.
 */
export default function AutoservicePrintPreview({ children, className = '' }) {
  const viewportRef = useRef(null);
  const sheetRef = useRef(null);
  const dragRef = useRef(null);
  const pinchRef = useRef(null);

  const [metrics, setMetrics] = useState({ width: 0, height: 0, fitScale: 1 });
  const [userZoom, setUserZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [pinching, setPinching] = useState(false);

  const totalScale = metrics.fitScale * userZoom;

  const getViewportSize = useCallback(() => {
    const node = viewportRef.current;
    if (!node) return { width: 0, height: 0 };
    return { width: node.clientWidth, height: node.clientHeight };
  }, []);

  const getContentSize = useCallback(() => {
    return {
      width: metrics.width * totalScale,
      height: metrics.height * totalScale,
    };
  }, [metrics.width, metrics.height, totalScale]);

  const applyPan = useCallback(
    (nextPan) => {
      const viewport = getViewportSize();
      const content = getContentSize();
      setPan(clampPan(nextPan, viewport, content.width, content.height));
    },
    [getContentSize, getViewportSize],
  );

  const updateMetrics = useCallback(() => {
    const sheet = sheetRef.current?.firstElementChild;
    const viewport = viewportRef.current;
    if (!sheet || !viewport) return;

    const naturalWidth = sheet.offsetWidth;
    const naturalHeight = sheet.offsetHeight;
    if (!naturalWidth || !naturalHeight) return;

    const available = Math.max(280, viewport.clientWidth);
    const fitScale = naturalWidth > available ? available / naturalWidth : 1;
    setMetrics({ width: naturalWidth, height: naturalHeight, fitScale });
  }, []);

  useEffect(() => {
    updateMetrics();
    const sheet = sheetRef.current?.firstElementChild;
    if (!sheet) return undefined;

    const ro = new ResizeObserver(() => updateMetrics());
    ro.observe(sheet);
    window.addEventListener('resize', updateMetrics);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateMetrics);
    };
  }, [updateMetrics, children]);

  useEffect(() => {
    setPan((current) => {
      const viewport = getViewportSize();
      const scale = metrics.fitScale * userZoom;
      return clampPan(
        current,
        viewport,
        metrics.width * scale,
        metrics.height * scale,
      );
    });
  }, [metrics.width, metrics.height, metrics.fitScale, userZoom, getViewportSize]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return undefined;

    const blockTouchScroll = (event) => {
      if (dragging || pinching) {
        event.preventDefault();
      }
    };

    node.addEventListener('touchmove', blockTouchScroll, { passive: false });
    return () => node.removeEventListener('touchmove', blockTouchScroll);
  }, [dragging, pinching]);

  const zoomAtPoint = useCallback(
    (nextUserZoom, point) => {
      const clampedZoom = Math.max(MIN_USER_ZOOM, Math.min(MAX_USER_ZOOM, nextUserZoom));
      const oldScale = metrics.fitScale * userZoom;
      const newScale = metrics.fitScale * clampedZoom;
      if (!oldScale || oldScale === newScale) {
        setUserZoom(clampedZoom);
        return;
      }

      const ratio = newScale / oldScale;
      setUserZoom(clampedZoom);
      applyPan({
        x: point.x - (point.x - pan.x) * ratio,
        y: point.y - (point.y - pan.y) * ratio,
      });
    },
    [applyPan, metrics.fitScale, pan.x, pan.y, userZoom],
  );

  const handlePointerDown = (event) => {
    if (isInteractiveTarget(event.target)) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setDragging(true);
    viewportRef.current?.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    applyPan({
      x: drag.panX + (event.clientX - drag.startX),
      y: drag.panY + (event.clientY - drag.startY),
    });
    event.preventDefault();
  };

  const endPointerDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    viewportRef.current?.releasePointerCapture(event.pointerId);
  };

  const handleTouchStart = (event) => {
    if (event.touches.length !== 2) return;

    dragRef.current = null;
    setDragging(false);
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    pinchRef.current = {
      startDistance: touchDistance(event.touches),
      startZoom: userZoom,
      startPan: { ...pan },
      center: touchCenter(event.touches, rect),
    };
    setPinching(true);
    event.preventDefault();
  };

  const handleTouchMove = (event) => {
    if (event.touches.length !== 2 || !pinchRef.current) return;

    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    const distance = touchDistance(event.touches);
    const nextZoom = pinchRef.current.startZoom * (distance / pinchRef.current.startDistance);
    const center = touchCenter(event.touches, rect);
    zoomAtPoint(nextZoom, center);
    event.preventDefault();
  };

  const handleTouchEnd = () => {
    dragRef.current = null;
    pinchRef.current = null;
    setDragging(false);
    setPinching(false);
  };

  const handleWheel = (event) => {
    if (isInteractiveTarget(event.target)) return;

    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    const point = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.08 : 0.92;
      zoomAtPoint(userZoom * factor, point);
      return;
    }

    event.preventDefault();
    applyPan({
      x: pan.x - event.deltaX,
      y: pan.y - event.deltaY,
    });
  };

  const contentHeight = metrics.height * totalScale;
  const viewportHeight = getViewportSize().height;
  const canPan = userZoom > 1.01 || contentHeight > viewportHeight + 1;

  return (
    <div
      ref={viewportRef}
      className={`autoservice-print-preview ${dragging ? 'is-dragging' : ''} ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointerDrag}
      onPointerCancel={endPointerDrag}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onWheel={handleWheel}
      style={{ cursor: dragging ? 'grabbing' : canPan ? 'grab' : 'default' }}
    >
      <div
        className="autoservice-print-preview__transform"
        style={
          metrics.width
            ? {
                width: metrics.width,
                height: metrics.height,
                '--preview-x': `${pan.x}px`,
                '--preview-y': `${pan.y}px`,
                '--preview-scale': String(totalScale),
              }
            : undefined
        }
      >
        <div ref={sheetRef}>{children}</div>
      </div>
    </div>
  );
}
