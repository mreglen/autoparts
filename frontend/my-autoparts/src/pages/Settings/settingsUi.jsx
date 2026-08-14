import { useEffect, useState } from 'react';
import { useActionsDropdownPlacement } from '../../hooks/useActionsDropdownPlacement';
import { buildActionsDropdownMenuClassName } from '../../utils/actionsDropdownPlacement';
import Button from '../../components/UI/Button';

export const settingsInputClass =
    'w-full rounded-sg border border-line bg-white px-3 py-2.5 text-sm text-ink shadow-sg-sm transition-colors placeholder:text-ink-faint focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

export const settingsBtnPrimary =
    'inline-flex items-center justify-center rounded-sg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50';

export const settingsBtnSecondary =
    'inline-flex items-center justify-center rounded-sg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface-muted disabled:opacity-50';

export const settingsBtnSmPrimary =
    'inline-flex items-center justify-center rounded-sg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50';

export const settingsBtnSmSecondary =
    'inline-flex items-center justify-center rounded-sg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-surface-muted disabled:opacity-50';

export const settingsCardClass = 'rounded-sg-lg border border-line bg-surface p-5 shadow-sg sm:p-6';

function cx(...parts) {
    return parts.filter(Boolean).join(' ');
}

export function SettingsGroupLabel({ children }) {
    return (
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
            {children}
        </h2>
    );
}

export function SettingsCard({ children, className = '', padding = true }) {
    return (
        <section
            className={cx(
                'rounded-sg-lg border border-line bg-surface shadow-sg',
                padding ? 'p-5 sm:p-6' : '',
                className,
            )}
        >
            {children}
        </section>
    );
}

export function SettingsSectionHeader({ title, subtitle, icon, action }) {
    return (
        <div className="mb-5 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
                {icon ? (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                        {icon}
                    </span>
                ) : null}
                <div className="min-w-0 pt-0.5">
                    <h3 className="text-base font-semibold text-ink">{title}</h3>
                    {subtitle ? <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p> : null}
                </div>
            </div>
            {action}
        </div>
    );
}

export function SettingsInfoRow({ icon, label, value, children }) {
    return (
        <div className="flex items-start gap-3 rounded-sg border border-line bg-surface-subtle/70 px-4 py-3">
            {icon ? (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-700 shadow-sg-sm ring-1 ring-line">
                    {icon}
                </div>
            ) : null}
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
                {children ?? (
                    <p className="mt-0.5 break-words text-sm font-medium text-ink">{value || '—'}</p>
                )}
            </div>
        </div>
    );
}

export function SettingsToggle({ checked, onChange, disabled, label, description }) {
    return (
        <label
            className={cx(
                'flex cursor-pointer items-center justify-between gap-4 rounded-xl px-4 py-3.5 transition',
                checked ? 'bg-white ring-2 ring-indigo-400/70' : 'bg-gray-100 hover:bg-gray-200/80',
                disabled ? 'cursor-not-allowed opacity-60' : '',
            )}
        >
            <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-900">{label}</span>
                {description ? <span className="mt-0.5 block text-sm text-gray-500">{description}</span> : null}
            </span>
            <span className="relative shrink-0">
                <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={checked}
                    disabled={disabled}
                    onChange={onChange}
                />
                <span className="relative block h-6 w-11 rounded-full bg-gray-200 transition-colors peer-checked:bg-indigo-600 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-400/70 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
            </span>
        </label>
    );
}

export function SettingsIconButton({ onClick, label, danger = false, disabled = false, children }) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className={cx(
                'inline-flex h-9 w-9 items-center justify-center rounded-sg border border-line bg-white text-ink-muted transition hover:bg-surface-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-50',
                danger ? 'hover:border-danger-200 hover:bg-danger-50 hover:text-danger-700' : '',
            )}
        >
            {children}
        </button>
    );
}

export function SettingsEditButton({ onClick, isEditing, onCancel, title = 'Изменить' }) {
    if (isEditing) {
        return (
            <Button type="button" variant="secondary" size="sm" onClick={onCancel ?? onClick}>
                Отмена
            </Button>
        );
    }
    return (
        <Button type="button" variant="secondary" size="sm" onClick={onClick}>
            {title}
        </Button>
    );
}

export function SettingsEmptyState({ title, message, variant = 'warning' }) {
    const iconColor = variant === 'error' ? 'text-danger-600' : 'text-warning-600';
    return (
        <SettingsCard>
            <div className="py-8 text-center">
                <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-subtle ${iconColor}`}>
                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h2 className="text-lg font-semibold text-ink">{title}</h2>
                <p className="mt-2 text-sm text-ink-muted">{message}</p>
            </div>
        </SettingsCard>
    );
}

const actionsMenuItemClass =
    'w-full text-left px-4 py-2.5 text-sm text-ink-soft hover:bg-surface-subtle flex items-center gap-2';

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
        <div ref={anchorRef} className="actions-dropdown relative shrink-0">
            <button
                type="button"
                disabled={disabled}
                onClick={(e) => {
                    e.stopPropagation();
                    setOpen((prev) => !prev);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-sg border border-line bg-white text-ink-muted transition hover:bg-surface-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Действия"
            >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
            </button>
            {open && items.length > 0 ? (
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
                            className={`${actionsMenuItemClass} ${item.disabled ? 'cursor-not-allowed opacity-50' : ''} ${item.danger ? 'text-danger-700 hover:bg-danger-50' : ''}`}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
