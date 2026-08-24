import { useCallback, useEffect, useRef, useState } from 'react';
import ActionsDropdown, { ActionsDropdownItem } from '../ActionsDropdown/ActionsDropdown';

function sameZoneId(a, b) {
  return String(a) === String(b);
}

function reorderItems(items, activeId, overId) {
  if (activeId == null || overId == null || sameZoneId(activeId, overId)) return items;
  const oldIndex = items.findIndex((item) => sameZoneId(item.id, activeId));
  const newIndex = items.findIndex((item) => sameZoneId(item.id, overId));
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
  const itemsRef = useRef(items);
  const dragRef = useRef(null);
  const overIdRef = useRef(null);
  const onReorderRef = useRef(onReorder);

  useEffect(() => {
    setItems(zones);
  }, [zones]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    onReorderRef.current = onReorder;
  }, [onReorder]);

  const findRowIdFromPoint = useCallback((clientX, clientY) => {
    const element = document.elementFromPoint(clientX, clientY);
    const row = element?.closest('[data-zone-row-id]');
    if (!row || !listRef.current?.contains(row)) return null;
    const raw = row.getAttribute('data-zone-row-id');
    if (raw == null || raw === '') return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : raw;
  }, []);

  const applyReorder = useCallback(async (next) => {
    setItems(next);
    itemsRef.current = next;
    await onReorderRef.current?.(next);
  }, []);

  useEffect(() => {
    const finishDrag = (event) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      dragRef.current = null;
      setDraggingId(null);
      setOverId(null);

      const targetId = findRowIdFromPoint(event.clientX, event.clientY)
        ?? overIdRef.current
        ?? drag.activeId;
      overIdRef.current = null;

      if (targetId == null || sameZoneId(drag.activeId, targetId)) return;

      const next = reorderItems(itemsRef.current, drag.activeId, targetId);
      if (next === itemsRef.current) return;
      applyReorder(next);
    };

    const onPointerMove = (event) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const targetId = findRowIdFromPoint(event.clientX, event.clientY);
      if (targetId != null && !sameZoneId(targetId, drag.activeId)) {
        overIdRef.current = targetId;
        setOverId(targetId);
      }
    };

    const onPointerEnd = (event) => {
      finishDrag(event);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
    };
  }, [applyReorder, findRowIdFromPoint]);

  const startDrag = useCallback((event, zoneId) => {
    if (disabled || loading) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { activeId: zoneId, pointerId: event.pointerId };
    overIdRef.current = zoneId;
    setDraggingId(zoneId);
    setOverId(zoneId);
  }, [disabled, loading]);

  if (loading) {
    return <p className="py-12 text-center text-sm text-gray-500">Загрузка…</p>;
  }

  if (!items.length) {
    return <p className="py-12 text-center text-sm text-gray-500">Зон пока нет</p>;
  }

  return (
    <div ref={listRef}>
      <div className="hidden border-b border-gray-200 pb-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 md:grid md:grid-cols-[3rem_minmax(0,1fr)_10rem] md:gap-3">
        <span>Порядок</span>
        <span>Название</span>
        <span className="text-right">Действия</span>
      </div>

      <div className="divide-y divide-gray-100">
        {items.map((zone) => {
          const isDragging = sameZoneId(draggingId, zone.id);
          const isOver = overId != null
            && draggingId != null
            && sameZoneId(overId, zone.id)
            && !sameZoneId(draggingId, zone.id);

          return (
            <div
              key={zone.id}
              data-zone-row-id={zone.id}
              className={`grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 py-3 transition-colors md:grid-cols-[3rem_minmax(0,1fr)_10rem] ${
                isDragging ? 'opacity-60' : ''
              } ${isOver ? 'bg-indigo-50/80' : 'hover:bg-gray-50/70'}`}
            >
              <button
                type="button"
                aria-label={`Перетащить ${zone.name}`}
                disabled={disabled || loading}
                onPointerDown={(event) => startDrag(event, zone.id)}
                className="inline-flex h-9 w-9 shrink-0 touch-none cursor-grab items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
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
