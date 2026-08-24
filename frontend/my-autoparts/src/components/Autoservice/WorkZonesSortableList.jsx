import { useCallback, useEffect, useRef, useState } from 'react';
import ActionsDropdown, { ActionsDropdownItem } from '../ActionsDropdown/ActionsDropdown';

function reorderItems(items, activeId, overId) {
  if (activeId == null || overId == null || activeId === overId) return items;
  const oldIndex = items.findIndex((item) => item.id === activeId);
  const newIndex = items.findIndex((item) => item.id === overId);
  if (oldIndex < 0 || newIndex < 0) return items;
  const next = [...items];
  const [moved] = next.splice(oldIndex, 1);
  next.splice(newIndex, 0, moved);
  return next;
}

function DragHandleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <circle cx="9" cy="7" r="1.4" fill="currentColor" />
      <circle cx="15" cy="7" r="1.4" fill="currentColor" />
      <circle cx="9" cy="12" r="1.4" fill="currentColor" />
      <circle cx="15" cy="12" r="1.4" fill="currentColor" />
      <circle cx="9" cy="17" r="1.4" fill="currentColor" />
      <circle cx="15" cy="17" r="1.4" fill="currentColor" />
    </svg>
  );
}

function ZoneActions({ zone, onEdit, onRemove, compact = false }) {
  return (
    <ActionsDropdown
      menuClassName="w-40 z-50"
      estimatedMenuHeight={100}
      showLabel={!compact}
      buttonClassName={
        compact
          ? 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50'
          : 'inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1'
      }
    >
      <ActionsDropdownItem onClick={() => onEdit(zone)}>Изменить</ActionsDropdownItem>
      <ActionsDropdownItem danger onClick={() => onRemove(zone.id)}>Удалить</ActionsDropdownItem>
    </ActionsDropdown>
  );
}

export default function WorkZonesSortableList({
  zones,
  loading = false,
  disabled = false,
  onReorder,
  onEdit,
  onRemove,
}) {
  const [items, setItems] = useState(zones);
  const [draggingId, setDraggingId] = useState(null);
  const [overId, setOverId] = useState(null);
  const listRef = useRef(null);
  const dragStateRef = useRef(null);

  useEffect(() => {
    setItems(zones);
  }, [zones]);

  const findRowIdFromPoint = useCallback((clientX, clientY) => {
    const element = document.elementFromPoint(clientX, clientY);
    const row = element?.closest('[data-zone-row-id]');
    if (!row || !listRef.current?.contains(row)) return null;
    const raw = row.getAttribute('data-zone-row-id');
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, []);

  const finishDrag = useCallback(async (activeId, targetId) => {
    setDraggingId(null);
    setOverId(null);
    dragStateRef.current = null;
    if (activeId == null || targetId == null || activeId === targetId) return;
    const next = reorderItems(items, activeId, targetId);
    if (next === items) return;
    setItems(next);
    await onReorder?.(next);
  }, [items, onReorder]);

  const handlePointerMove = useCallback((event) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const targetId = findRowIdFromPoint(event.clientX, event.clientY);
    if (targetId != null && targetId !== drag.activeId) {
      setOverId(targetId);
    }
  }, [findRowIdFromPoint]);

  const handlePointerUp = useCallback((event) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);
    const targetId = findRowIdFromPoint(event.clientX, event.clientY) ?? overId ?? drag.activeId;
    finishDrag(drag.activeId, targetId);
  }, [findRowIdFromPoint, finishDrag, handlePointerMove, overId]);

  const startDrag = useCallback((event, zoneId) => {
    if (disabled || loading) return;
    event.preventDefault();
    event.stopPropagation();
    dragStateRef.current = { activeId: zoneId, pointerId: event.pointerId };
    setDraggingId(zoneId);
    setOverId(zoneId);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, [disabled, loading, handlePointerMove, handlePointerUp]);

  useEffect(() => () => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);
  }, [handlePointerMove, handlePointerUp]);

  const displayItems = items;

  if (loading) {
    return <p className="py-12 text-center text-sm text-gray-500">Загрузка…</p>;
  }

  if (!displayItems.length) {
    return <p className="py-12 text-center text-sm text-gray-500">Зон пока нет</p>;
  }

  return (
    <div ref={listRef}>
      <div className="hidden border-b border-gray-200 pb-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 md:grid md:grid-cols-[2.5rem_minmax(0,1fr)_10rem] md:gap-3">
        <span aria-hidden />
        <span>Название</span>
        <span className="text-right">Действия</span>
      </div>

      <div className="divide-y divide-gray-100">
        {displayItems.map((zone) => {
          const isDragging = draggingId === zone.id;
          const isOver = overId === zone.id && draggingId != null && draggingId !== zone.id;
          return (
            <div
              key={zone.id}
              data-zone-row-id={zone.id}
              className={`grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 py-3 transition-colors md:grid-cols-[2.5rem_minmax(0,1fr)_10rem] ${
                isDragging ? 'opacity-60' : ''
              } ${isOver ? 'bg-indigo-50/80' : 'hover:bg-gray-50/70'}`}
            >
              <button
                type="button"
                aria-label={`Перетащить ${zone.name}`}
                disabled={disabled || loading}
                onPointerDown={(event) => startDrag(event, zone.id)}
                className="inline-flex h-9 w-9 touch-none cursor-grab items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
              >
                <DragHandleIcon />
              </button>
              <p className="min-w-0 truncate text-sm font-semibold text-gray-900 md:font-medium">{zone.name}</p>
              <div className="justify-self-end">
                <div className="hidden md:block">
                  <ZoneActions zone={zone} onEdit={onEdit} onRemove={onRemove} />
                </div>
                <div className="md:hidden">
                  <ZoneActions zone={zone} onEdit={onEdit} onRemove={onRemove} compact />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
