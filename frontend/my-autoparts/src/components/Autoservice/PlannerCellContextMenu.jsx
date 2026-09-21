import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

function MenuButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-1.5 rounded-sg-sm px-2.5 py-1.5 text-left text-xs font-medium text-ink transition hover:bg-surface-muted"
    >
      <span className="text-base font-semibold leading-none text-ink-soft">+</span>
      {children}
    </button>
  );
}

export default function PlannerCellContextMenu({
  position,
  onClose,
  onCreateInspection,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!position) return undefined;

    const handlePointerDown = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      onClose?.();
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    const handleScroll = () => onClose?.();

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [position, onClose]);

  if (!position) return null;

  const menuWidth = 150;
  const menuHeight = 32;
  const padding = 8;
  const left = Math.min(position.x, window.innerWidth - menuWidth - padding);
  const top = Math.min(position.y, window.innerHeight - menuHeight - padding);

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[120] w-max rounded-md border border-line bg-surface p-1 shadow-sg-lg"
      style={{ left, top }}
      role="menu"
    >
      <MenuButton
        onClick={() => {
          onCreateInspection?.();
          onClose?.();
        }}
      >
        Запись на осмотр
      </MenuButton>
    </div>,
    document.body,
  );
}
