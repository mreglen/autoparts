import { useCallback, useEffect, useRef, useState } from 'react';
import { useAllowViewportZoom } from '../../hooks/useAllowViewportZoom';

/**
 * На узком экране уменьшает лист документа пропорционально (как на ПК, но мельче).
 * Печать и PDF не затрагивает — обёртки исчезают через print:contents.
 */
export default function AutoservicePrintPreview({ children, className = '' }) {
  useAllowViewportZoom();

  const sheetRef = useRef(null);
  const [frame, setFrame] = useState({ scale: 1, width: 0, height: 0 });

  const update = useCallback(() => {
    const sheet = sheetRef.current?.firstElementChild;
    if (!sheet) return;
    const naturalWidth = sheet.offsetWidth;
    const naturalHeight = sheet.offsetHeight;
    if (!naturalWidth) return;

    const available = Math.max(280, window.innerWidth - 32);
    const scale = naturalWidth > available ? available / naturalWidth : 1;
    setFrame({
      scale,
      width: Math.ceil(naturalWidth * scale),
      height: Math.ceil(naturalHeight * scale),
    });
  }, []);

  useEffect(() => {
    update();
    const host = sheetRef.current;
    const sheet = host?.firstElementChild;
    if (!sheet) return undefined;

    const ro = new ResizeObserver(() => update());
    ro.observe(sheet);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [update, children]);

  const scaled = frame.scale < 0.999;

  return (
    <div className={`autoservice-print-preview ${className} print:contents`}>
      <div
        className="autoservice-print-preview__frame mx-auto print:contents"
        style={scaled ? { width: frame.width, height: frame.height } : undefined}
      >
        <div
          className="autoservice-print-preview__scale print:contents"
          style={
            scaled
              ? {
                  width: frame.width / frame.scale,
                  transform: `scale(${frame.scale})`,
                  transformOrigin: 'top left',
                }
              : undefined
          }
        >
          <div ref={sheetRef} className="print:contents">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
