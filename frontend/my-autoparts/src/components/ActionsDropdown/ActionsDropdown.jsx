import React, { useEffect, useState } from 'react';
import { useActionsDropdownPlacement } from '../../hooks/useActionsDropdownPlacement';
import { buildActionsDropdownMenuClassName } from '../../utils/actionsDropdownPlacement';

function ActionsDotsIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
      />
    </svg>
  );
}

/**
 * Универсальное меню «Действия» с авто-разворотом вверх у нижнего края viewport.
 */
export default function ActionsDropdown({
  children,
  buttonClassName,
  menuClassName = 'w-48 z-50',
  estimatedMenuHeight = 220,
  showLabel = true,
  label = 'Действия',
  containerClassName = 'relative inline-block actions-dropdown',
  disabled = false,
  isOpen: controlledOpen,
  onOpenChange,
  /** Принудительно открывать вверх (например, последняя строка таблицы). */
  preferOpenUp = false,
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = (next) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const { anchorRef, openUp: autoOpenUp } = useActionsDropdownPlacement(open, estimatedMenuHeight);
  const openUp = preferOpenUp || autoOpenUp;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.actions-dropdown')) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const defaultButtonClass =
    'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div ref={anchorRef} className={containerClassName}>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className={buttonClassName || defaultButtonClass}
      >
        <ActionsDotsIcon />
        {showLabel ? <span>{label}</span> : null}
      </button>
      {open && children ? (
        <div className={buildActionsDropdownMenuClassName(openUp, menuClassName)}>{children}</div>
      ) : null}
    </div>
  );
}

export function ActionsDropdownItem({
  onClick,
  children,
  className = '',
  danger = false,
  disabled = false,
  title,
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-gray-50 ${
        danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`.trim()}
    >
      {children}
    </button>
  );
}
