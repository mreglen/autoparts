import { useEffect, useState } from 'react';
import { useActionsDropdownPlacement } from '../../hooks/useActionsDropdownPlacement';
import { buildActionsDropdownMenuClassName } from '../../utils/actionsDropdownPlacement';

export const settingsInputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

export const settingsBtnPrimary =
    'inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50';

export const settingsBtnSecondary =
    'inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50';

export const settingsBtnSmPrimary =
    'rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50';

export const settingsBtnSmSecondary =
    'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50';

export const settingsCardClass = 'rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6';

export const settingsActionsBtnClass =
    'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed';

const actionsMenuItemClass =
    'w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2';

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

export function SettingsActionsDropdown({ items = [], disabled = false, menuWidth = 'w-48' }) {
    const [open, setOpen] = useState(false);
    const { anchorRef, openUp } = useActionsDropdownPlacement(open, Math.max(120, items.length * 44 + 16));

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

    return (
        <div ref={anchorRef} className="relative actions-dropdown shrink-0">
            <button
                type="button"
                disabled={disabled}
                onClick={(e) => {
                    e.stopPropagation();
                    setOpen((prev) => !prev);
                }}
                className={settingsActionsBtnClass}
            >
                <ActionsDotsIcon />
                <span className="hidden sm:inline">Действия</span>
            </button>
            {open && items.length > 0 && (
                <div className={buildActionsDropdownMenuClassName(openUp, `${menuWidth} z-50`)}>
                    {items.map((item, index) => (
                        <button
                            key={item.key ?? `${item.label}-${index}`}
                            type="button"
                            disabled={item.disabled}
                            onClick={(e) => {
                                e.stopPropagation();
                                item.onClick?.();
                                setOpen(false);
                            }}
                            className={`${actionsMenuItemClass} ${item.disabled ? 'cursor-not-allowed opacity-50' : ''} ${item.danger ? 'text-red-600 hover:bg-red-50' : ''}`}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export function SettingsCard({ children, className = '' }) {
    return <section className={`${settingsCardClass} ${className}`.trim()}>{children}</section>;
}

export function SettingsSectionHeader({ title, subtitle, icon, action }) {
    return (
        <div className="mb-5 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
                {icon && (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                        {icon}
                    </span>
                )}
                <div className="min-w-0">
                    <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                    {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
                </div>
            </div>
            {action}
        </div>
    );
}

export function SettingsInfoRow({ icon, label, value, children }) {
    return (
        <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm ring-1 ring-gray-100">
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
                {children ?? (
                    <p className="mt-0.5 text-sm font-medium text-gray-900 break-words">{value || '—'}</p>
                )}
            </div>
        </div>
    );
}

const editIcon = (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
);

const cancelIcon = (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

export function SettingsEditButton({ onClick, isEditing, onCancel, title = 'Редактировать' }) {
    const items = isEditing
        ? [{ label: 'Отмена', onClick: onCancel ?? onClick, icon: cancelIcon }]
        : [{ label: title, onClick, icon: editIcon }];

    return <SettingsActionsDropdown items={items} menuWidth="w-44" />;
}

export function SettingsEmptyState({ title, message, variant = 'warning' }) {
    const iconColor = variant === 'error' ? 'text-red-500' : 'text-amber-500';
    return (
        <SettingsCard>
            <div className="py-6 text-center">
                <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-50 ${iconColor}`}>
                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                <p className="mt-2 text-sm text-gray-500">{message}</p>
            </div>
        </SettingsCard>
    );
}
