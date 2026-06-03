import React from 'react';
import UserAvatar from '../../components/UserAvatar/UserAvatar';
import { AuditDetailsStructured } from './auditDetailsView';

function roleBadges(user) {
    if (!user) return [];
    const badges = [];
    if (user.is_admin) badges.push({ label: 'Администратор', className: 'bg-purple-100 text-purple-800' });
    if (user.is_seller) badges.push({ label: 'Продавец', className: 'bg-indigo-100 text-indigo-800' });
    if (user.is_director) badges.push({ label: 'Директор', className: 'bg-blue-100 text-blue-800' });
    if (user.is_employee) badges.push({ label: 'Сотрудник', className: 'bg-gray-100 text-gray-700' });
    if (user.is_buyer) badges.push({ label: 'Покупатель', className: 'bg-emerald-100 text-emerald-800' });
    return badges;
}

function userFullName(user) {
    const parts = [user?.last_name, user?.first_name, user?.patronymic].filter(Boolean);
    return parts.join(' ').trim() || user?.email || '—';
}

export default function UserDetailModal({
    user,
    audit,
    auditLoading,
    activeTab,
    auditPage,
    onTabChange,
    onAuditPageChange,
    onClose,
    formatAuditDate,
    labelCategory,
    labelEventType,
    parseDetails,
}) {
    if (!user) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4">
                <div className="rounded-none sm:rounded-2xl bg-white p-8 w-full sm:w-auto min-h-[12rem] sm:min-h-0 flex items-center justify-center">
                    <div className="animate-spin h-10 w-10 border-b-2 border-indigo-600 rounded-full mx-auto" />
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'overview', label: 'Обзор' },
        { id: 'audit', label: 'Журнал аудита' },
    ];

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="flex max-h-[100dvh] sm:max-h-[90vh] h-full sm:h-auto w-full max-w-4xl flex-col overflow-hidden rounded-none sm:rounded-2xl border-0 sm:border border-gray-200 bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="user-detail-modal-title"
            >
                <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-4 sm:px-6 py-4 sm:py-5">
                    <div className="flex items-center gap-4 min-w-0">
                        <UserAvatar
                            avatarUrl={user.avatar_url}
                            firstName={user.first_name}
                            lastName={user.last_name}
                            size="lg"
                        />
                        <div className="min-w-0">
                            <h3 id="user-detail-modal-title" className="text-lg font-semibold text-gray-900 truncate">{userFullName(user)}</h3>
                            <p className="text-sm text-gray-500">{user.email}</p>
                            {user.public_code && (
                                <p className="text-xs font-mono text-gray-400 mt-0.5">ID {user.public_code}</p>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
                        aria-label="Закрыть"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex gap-1 border-b border-gray-100 px-4 sm:px-6 overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => onTabChange(tab.id)}
                            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                                activeTab === tab.id
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
                    {activeTab === 'overview' && (
                        <div className="space-y-6 text-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <span className="text-gray-500">Телефон</span>
                                    <p className="font-medium">{user.phone || '—'}</p>
                                </div>
                                <div>
                                    <span className="text-gray-500">Организация</span>
                                    <p className="font-medium">{user.organization_name || '—'}</p>
                                    {user.organization_id && (
                                        <p className="text-xs font-mono text-gray-400">{user.organization_id}</p>
                                    )}
                                </div>
                                <div className="sm:col-span-2">
                                    <span className="text-gray-500">Роли</span>
                                    <div className="mt-1 flex flex-wrap gap-2">
                                        {roleBadges(user).map((b) => (
                                            <span key={b.label} className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${b.className}`}>
                                                {b.label}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-gray-500">Активных сессий</span>
                                    <p className="font-medium">{user.active_sessions_count ?? 0}</p>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-semibold text-gray-900 mb-3">Сессии</h4>
                                {(user.sessions || []).length === 0 ? (
                                    <p className="text-gray-500">Нет записей о сессиях</p>
                                ) : (
                                    <div className="overflow-x-auto rounded-lg border border-gray-100">
                                        <table className="min-w-full text-xs">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-gray-600">Устройство</th>
                                                    <th className="px-3 py-2 text-left text-gray-600">IP</th>
                                                    <th className="px-3 py-2 text-left text-gray-600">Статус</th>
                                                    <th className="px-3 py-2 text-left text-gray-600">Последняя активность</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {user.sessions.map((s) => (
                                                    <tr key={s.id}>
                                                        <td className="px-3 py-2">{s.device_info || '—'}</td>
                                                        <td className="px-3 py-2 font-mono">{s.ip_address || '—'}</td>
                                                        <td className="px-3 py-2">
                                                            <span className={s.is_active ? 'text-emerald-700' : 'text-gray-500'}>
                                                                {s.is_active ? 'Активна' : 'Завершена'}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-gray-600">
                                                            {s.last_activity ? formatAuditDate(s.last_activity) : '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'audit' && (
                        <div className="space-y-4">
                            {auditLoading && !audit?.rows?.length ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin h-8 w-8 border-b-2 border-indigo-600 rounded-full" />
                                </div>
                            ) : (audit?.rows || []).length === 0 ? (
                                <p className="text-gray-500 text-center py-8">Событий не найдено</p>
                            ) : (
                                <ul className="space-y-4">
                                    {audit.rows.map((event) => {
                                        const details = parseDetails(event);
                                        return (
                                            <li key={event.id} className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                                                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                                                    <div>
                                                        <p className="font-medium text-gray-900">
                                                            {labelEventType(event.event_type)}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-0.5">
                                                            {formatAuditDate(event.created_at)}
                                                            {' · '}
                                                            {labelCategory(event.category)}
                                                        </p>
                                                    </div>
                                                    <span className="text-xs font-mono text-gray-400">#{event.id}</span>
                                                </div>
                                                {event.summary && (
                                                    <p className="text-sm text-gray-700 mb-2">{event.summary}</p>
                                                )}
                                                {event.actor_name && (
                                                    <p className="text-xs text-gray-500 mb-2">
                                                        Инициатор: {event.actor_name}
                                                        {event.ip_address && ` · IP ${event.ip_address}`}
                                                    </p>
                                                )}
                                                {details != null && (
                                                    <div className="mt-2 rounded-lg border border-gray-100 bg-white p-3 text-sm">
                                                        <AuditDetailsStructured data={details} />
                                                    </div>
                                                )}
                                                {details != null && (
                                                    <details className="mt-2">
                                                        <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
                                                            JSON
                                                        </summary>
                                                        <pre className="mt-1 max-h-32 overflow-auto rounded bg-gray-900 p-2 text-xs text-green-100">
                                                            {JSON.stringify(details, null, 2)}
                                                        </pre>
                                                    </details>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                            {audit && audit.pages > 1 && (
                                <div className="flex items-center justify-center gap-2 pt-4">
                                    <button
                                        type="button"
                                        disabled={auditPage <= 1 || auditLoading}
                                        onClick={() => onAuditPageChange(auditPage - 1)}
                                        className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40"
                                    >
                                        Назад
                                    </button>
                                    <span className="text-sm text-gray-600">
                                        {auditPage} / {audit.pages}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={auditPage >= audit.pages || auditLoading}
                                        onClick={() => onAuditPageChange(auditPage + 1)}
                                        className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40"
                                    >
                                        Вперёд
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="border-t border-gray-100 px-4 sm:px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                    >
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    );
}
