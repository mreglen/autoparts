import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * Вкладки с одной чёрной полоской, которая плавно скользит к активной.
 *
 * tabs: [{ id, label, shortLabel?, count? }]
 */
export default function UnderlineTabs({
  tabs,
  value,
  onChange,
  ariaLabel = 'Вкладки',
  className = '',
  gapClassName = 'gap-1 sm:gap-6',
  tabClassName = 'pb-3 pt-1 text-sm font-medium sm:text-[15px]',
}) {
  const listRef = useRef(null);
  const tabRefs = useRef(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  const setTabRef = useCallback((id, node) => {
    if (node) tabRefs.current.set(id, node);
    else tabRefs.current.delete(id);
  }, []);

  const updateIndicator = useCallback(() => {
    const list = listRef.current;
    const active = tabRefs.current.get(value);
    if (!list || !active) {
      setIndicator((prev) => ({ ...prev, ready: false, width: 0 }));
      return;
    }
    const listRect = list.getBoundingClientRect();
    const tabRect = active.getBoundingClientRect();
    setIndicator({
      left: tabRect.left - listRect.left + list.scrollLeft,
      width: tabRect.width,
      ready: true,
    });
  }, [value]);

  useLayoutEffect(() => {
    updateIndicator();

    const list = listRef.current;
    if (!list) return undefined;

    const onScrollOrResize = () => updateIndicator();
    list.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);

    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(onScrollOrResize);
      resizeObserver.observe(list);
      tabRefs.current.forEach((node) => resizeObserver.observe(node));
    }

    return () => {
      list.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      resizeObserver?.disconnect();
    };
  }, [updateIndicator, tabs]);

  return (
    <div className={`border-b border-gray-200 ${className}`.trim()}>
      <div
        ref={listRef}
        className={`relative -mb-px flex overflow-x-auto ${gapClassName}`}
        role="tablist"
        aria-label={ariaLabel}
      >
        {tabs.map((tab) => {
          const isActive = value === tab.id;
          const hasCount = tab.count != null;
          return (
            <button
              key={tab.id}
              ref={(node) => setTabRef(tab.id, node)}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange?.(tab.id)}
              className={`relative shrink-0 whitespace-nowrap transition-colors ${tabClassName} ${
                isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.shortLabel ? (
                <>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </>
              ) : (
                <span>{tab.label}</span>
              )}
              {hasCount && tab.count > 0 ? (
                <span className="ml-1.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-gray-100 px-1.5 text-[10px] font-semibold tabular-nums text-gray-600">
                  {tab.count}
                </span>
              ) : null}
            </button>
          );
        })}

        <span
          className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-gray-900 transition-[transform,width] duration-300 ease-out motion-reduce:transition-none"
          style={{
            width: indicator.width,
            transform: `translateX(${indicator.left}px)`,
            opacity: indicator.ready ? 1 : 0,
          }}
          aria-hidden
        />
      </div>
    </div>
  );
}
