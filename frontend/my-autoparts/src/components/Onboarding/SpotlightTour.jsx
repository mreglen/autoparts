import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from '../UI/Button';

const TOUR_Z_INDEX = 120;
const TOOLTIP_GAP = 12;
const TOOLTIP_MAX_WIDTH = 320;
const VIEWPORT_MARGIN = 12;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function computeTooltipPosition(spotlightRect, tooltipSize, preferred = 'bottom') {
  if (!spotlightRect) {
    return {
      top: VIEWPORT_MARGIN,
      left: VIEWPORT_MARGIN,
      placement: preferred,
    };
  }

  const placements = [preferred, 'bottom', 'top', 'right', 'left'];
  const uniquePlacements = [...new Set(placements)];

  for (const placement of uniquePlacements) {
    let top = 0;
    let left = 0;

    if (placement === 'bottom') {
      top = spotlightRect.top + spotlightRect.height + TOOLTIP_GAP;
      left = spotlightRect.left + spotlightRect.width / 2 - tooltipSize.width / 2;
    } else if (placement === 'top') {
      top = spotlightRect.top - tooltipSize.height - TOOLTIP_GAP;
      left = spotlightRect.left + spotlightRect.width / 2 - tooltipSize.width / 2;
    } else if (placement === 'right') {
      top = spotlightRect.top + spotlightRect.height / 2 - tooltipSize.height / 2;
      left = spotlightRect.left + spotlightRect.width + TOOLTIP_GAP;
    } else {
      top = spotlightRect.top + spotlightRect.height / 2 - tooltipSize.height / 2;
      left = spotlightRect.left - tooltipSize.width - TOOLTIP_GAP;
    }

    top = clamp(top, VIEWPORT_MARGIN, window.innerHeight - tooltipSize.height - VIEWPORT_MARGIN);
    left = clamp(left, VIEWPORT_MARGIN, window.innerWidth - tooltipSize.width - VIEWPORT_MARGIN);

    const fitsVertically =
      top >= VIEWPORT_MARGIN
      && top + tooltipSize.height <= window.innerHeight - VIEWPORT_MARGIN;
    const fitsHorizontally =
      left >= VIEWPORT_MARGIN
      && left + tooltipSize.width <= window.innerWidth - VIEWPORT_MARGIN;

    if (fitsVertically && fitsHorizontally) {
      return { top, left, placement };
    }
  }

  return {
    top: clamp(
      spotlightRect.top + spotlightRect.height + TOOLTIP_GAP,
      VIEWPORT_MARGIN,
      window.innerHeight - tooltipSize.height - VIEWPORT_MARGIN,
    ),
    left: clamp(
      spotlightRect.left,
      VIEWPORT_MARGIN,
      window.innerWidth - tooltipSize.width - VIEWPORT_MARGIN,
    ),
    placement: 'bottom',
  };
}

function SpotlightOverlay({ rect }) {
  if (!rect) {
    return (
      <div
        className="fixed inset-0 bg-slate-900/65"
        style={{ zIndex: TOUR_Z_INDEX }}
        aria-hidden
      />
    );
  }

  return (
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: TOUR_Z_INDEX }}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed ring-2 ring-white/90"
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          borderRadius: rect.borderRadius,
          boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.65)',
          zIndex: TOUR_Z_INDEX,
        }}
        aria-hidden
      />
    </>
  );
}

export default function SpotlightTour({
  open,
  step,
  stepIndex,
  totalSteps,
  spotlightRect,
  isFirstStep,
  isLastStep,
  onNext,
  onPrev,
  onSkip,
  customFooter,
}) {
  const tooltipRef = useRef(null);
  const [tooltipSize, setTooltipSize] = useState({ width: TOOLTIP_MAX_WIDTH, height: 180 });
  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  useEffect(() => {
    if (!open || !tooltipRef.current) return undefined;

    const measure = () => {
      const rect = tooltipRef.current?.getBoundingClientRect();
      if (!rect) return;
      setTooltipSize({ width: rect.width, height: rect.height });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(tooltipRef.current);
    return () => observer.disconnect();
  }, [open, step, customFooter]);

  if (!open || !step) return null;

  const tooltipPosition = computeTooltipPosition(
    spotlightRect,
    tooltipSize,
    step.placement || (window.innerWidth < 640 ? 'bottom' : 'bottom'),
  );

  const content = (
    <div className="fixed inset-0" style={{ zIndex: TOUR_Z_INDEX }} role="presentation">
      <SpotlightOverlay rect={spotlightRect} />

      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="spotlight-tour-title"
        aria-describedby="spotlight-tour-body"
        className="fixed w-[min(100vw-24px,320px)] rounded-sg-lg border border-line bg-surface p-4 shadow-sg-lg"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          zIndex: TOUR_Z_INDEX + 1,
          transition: reducedMotion ? 'none' : 'top 0.2s ease, left 0.2s ease',
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs font-medium tabular-nums text-ink-muted">
            {stepIndex + 1} / {totalSteps}
          </p>
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-medium text-ink-muted hover:text-ink"
          >
            Пропустить
          </button>
        </div>

        <h3 id="spotlight-tour-title" className="text-base font-semibold text-ink">
          {step.title}
        </h3>
        <p id="spotlight-tour-body" className="mt-2 text-sm leading-relaxed text-ink-soft">
          {step.body}
        </p>

        {customFooter ? (
          <div className="mt-4">{customFooter}</div>
        ) : (
          <div className="mt-4 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isFirstStep}
              onClick={onPrev}
            >
              Назад
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={onNext}>
              {isLastStep ? 'Готово' : 'Далее'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
