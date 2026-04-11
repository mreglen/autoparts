import React, { useState, useRef } from 'react';

const SwipeableMessage = ({ message, onReply, children, isOwn }) => {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const swipeRef = useRef(null);

  const minSwipeDistance = 56;
  /** Горизонтальный свайд должен явно превосходить вертикальный, иначе это скролл */
  const horizontalVsVertical = 1.35;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    const t = e.targetTouches[0];
    setTouchStart({ x: t.clientX, y: t.clientY });
  };

  const onTouchMove = (e) => {
    if (!touchStart) return;
    const t = e.targetTouches[0];
    const dx = touchStart.x - t.clientX;
    const dy = touchStart.y - t.clientY;
    setSwipeOffset(Math.abs(dx));
    setTouchEnd({ x: t.clientX, y: t.clientY });
  };

  const resetTouch = () => {
    setSwipeOffset(0);
    setTouchStart(null);
    setTouchEnd(null);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      resetTouch();
      return;
    }

    const dx = touchStart.x - touchEnd.x;
    const dy = touchStart.y - touchEnd.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const isHorizontalReply =
      absX >= minSwipeDistance && absX >= absY * horizontalVsVertical;

    if (isHorizontalReply) {
      onReply(message);
    }

    resetTouch();
  };

  const onTouchCancel = () => {
    resetTouch();
  };

  const dragX =
    touchStart && touchEnd ? touchEnd.x - touchStart.x : 0;
  const hintDx =
    touchStart && touchEnd ? touchStart.x - touchEnd.x : 0;
  const hintDy =
    touchStart && touchEnd ? touchStart.y - touchEnd.y : 0;
  const showSwipeHint =
    swipeOffset > 32 &&
    touchStart &&
    touchEnd &&
    Math.abs(hintDx) >= Math.abs(hintDy) * horizontalVsVertical;

  return (
    <div
      ref={swipeRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      className="relative touch-pan-y overflow-visible"
      style={{
        transform: `translateX(${dragX}px)`,
        transition: swipeOffset > 0 ? 'none' : 'transform 0.2s ease',
      }}
    >
      {showSwipeHint ? (
        <div
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${
            isOwn ? 'left-0 -translate-x-full pr-3' : 'right-0 translate-x-full pl-3'
          }`}
        >
          <svg
            className="h-7 w-7 text-blue-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 6 6v0"
            />
          </svg>
        </div>
      ) : null}

      {children}
    </div>
  );
};

export default SwipeableMessage;
