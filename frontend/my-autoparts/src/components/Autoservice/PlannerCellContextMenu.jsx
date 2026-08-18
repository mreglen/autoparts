import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

function MenuButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-800 transition hover:bg-gray-100"
    >
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-100 text-xs font-bold text-indigo-700">
        +
      </span>
      <span>{children}</span>
    </button>
  );
}

export default function PlannerCellContextMenu({
  position,
  onClose,
  onCreateOrder,
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

  const menuWidth = 220;
  const menuHeight = 96;
  const padding = 8;
  const left = Math.min(position.x, window.innerWidth - menuWidth - padding);
  const top = Math.min(position.y, window.innerHeight - menuHeight - padding);

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[120] min-w-[13.5rem] rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg ring-1 ring-black/5"
      style={{ left, top }}
      role="menu"
    >
      <MenuButton
        onClick={() => {
          onCreateOrder?.();
          onClose?.();
        }}
      >
        Заказ-наряд
      </MenuButton>
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
