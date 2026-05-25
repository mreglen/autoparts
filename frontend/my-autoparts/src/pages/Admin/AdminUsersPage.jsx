import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    fetchAdminUsers,
    fetchAdminUserDetail,
    fetchAdminUserAudit,
    revokeUserSessions,
} from '../../redux/slices/AdminSlice';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import ActionsDropdown, { ActionsDropdownItem } from '../../components/ActionsDropdown/ActionsDropdown';
import UserAvatar from '../../components/UserAvatar/UserAvatar';
import UserDetailModal from './UserDetailModal';
import {
    formatAuditDate,
    labelCategory,
    labelEventType,
    parseDetails,
} from './auditDisplay';

function roleBadges(user) {
    const badges = [];
    if (user.is_admin) badges.push({ label: 'Админ', className: 'bg-purple-100 text-purple-800' });
    if (user.is_seller) badges.push({ label: 'Продавец', className: 'bg-indigo-100 text-indigo-800' });
    if (user.is_director) badges.push({ label: 'Директор', className: 'bg-blue-100 text-blue-800' });
    if (user.is_employee) badges.push({ label: 'Сотрудник', className: 'bg-gray-100 text-gray-700' });
    if (user.is_buyer) badges.push({ label: 'Покупатель', className: 'bg-emerald-100 text-emerald-800' });
    return badges;
}

function userFullName(user) {
    const parts = [user.last_name, user.first_name, user.patronymic].filter(Boolean);
    return parts.join(' ').trim() || user.email || '—';
}

export default function AdminUsersPage() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { isReady, user } = useAuthReady();
    const { users, loading, error, userDetail, userAudit, auditLoading } = useSelector((state) => state.admin);

    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('name_asc');
    const [showSortDropdown, setShowSortDropdown] = useState(false);
    const [showActionsPopup, setShowActionsPopup] = useState(null);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [detailTab, setDetailTab] = useState('overview');
    const [auditPage, setAuditPage] = useState(1);

    useEffect(() => {
        if (!isReady) return;
        if (!user?.is_admin) {
            navigate('/', { replace: true });
            return;
        }
        dispatch(fetchAdminUsers());
    }, [isReady, user, navigate, dispatch]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.actions-dropdown')) {
                setShowActionsPopup(null);
            }
        };
        if (showActionsPopup) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showActionsPopup]);

    const filteredUsers = useMemo(() => {
        let list = [...users];
        const q = searchQuery.trim().toLowerCase();
        if (q) {
            list = list.filter((u) => {
                const fullName = userFullName(u).toLowerCase();
                return (
                    fullName.includes(q)
                    || (u.email || '').toLowerCase().includes(q)
                    || (u.phone || '').toLowerCase().includes(q)
                    || (u.public_code || '').toLowerCase().includes(q)
                    || (u.organization_name || '').toLowerCase().includes(q)
                );
            });
        }
        if (sortOrder === 'name_asc' || sortOrder === 'name_desc') {
            list.sort((a, b) => {
                const aName = userFullName(a).toLowerCase();
                const bName = userFullName(b).toLowerCase();
                if (aName < bName) return sortOrder === 'name_asc' ? -1 : 1;
                if (aName > bName) return sortOrder === 'name_asc' ? 1 : -1;
                return 0;
            });
        } else if (sortOrder === 'email_asc') {
            list.sort((a, b) => String(a.email || '').localeCompare(String(b.email || ''), 'ru'));
        }
        return list;
    }, [users, searchQuery, sortOrder]);

    const openUserDetail = useCallback(
        (userId, tab = 'overview') => {
            setSelectedUserId(userId);
            setDetailTab(tab);
            setAuditPage(1);
            dispatch(fetchAdminUserDetail(userId));
            if (tab === 'audit') {
                dispatch(fetchAdminUserAudit({ userId, page: 1 }));
            }
        },
        [dispatch]
    );

    const closeDetail = () => {
        setSelectedUserId(null);
        setDetailTab('overview');
    };

    const handleRevokeSessions = async (userId) => {
        if (!window.confirm('Завершить все активные сессии этого пользователя?')) return;
        try {
            await dispatch(revokeUserSessions(userId)).unwrap();
            dispatch(fetchAdminUserDetail(userId));
            setShowActionsPopup(null);
        } catch {
            /* error in admin state */
        }
    };

    const loadAuditPage = (page) => {
        if (!selectedUserId) return;
        setAuditPage(page);
        dispatch(fetchAdminUserAudit({ userId: selectedUserId, page }));
    };

    if (!isReady) {
        return <AuthLoadingScreen className="min-h-[16rem]" />;
    }

    if (!user?.is_admin) {
        return null;
    }

    if (loading && users.length === 0) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
            </div>
        );
    }

    return (
        <div className="mt-4 sm:mt-5 px-4 sm:px-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                <h1 className="text-2xl font-bold text-gray-800">Пользователи</h1>
                <div className="text-sm text-gray-500">
                    Всего: <span className="font-semibold text-gray-900">{users.length}</span>
                </div>
            </div>

            <div className="mb-6 flex flex-col md:flex-row gap-4 md:items-end">
                <div className="flex-1 max-w-md">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Поиск</label>
                    <input
                        type="text"
                        placeholder="ФИО, email, телефон, ID, организация..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                </div>
                <div className="md:w-64 relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Сортировка</label>
                    <button
                        type="button"
                        onClick={() => setShowSortDropdown(!showSortDropdown)}
                        className="w-full px-4 py-2 rounded-lg font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 flex items-center justify-between"
                    >
                        <span>Выбор порядка</span>
                        <svg className={`w-4 h-4 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {showSortDropdown && (
                        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-30">
                            {[
                                { id: 'name_asc', label: 'По ФИО (А–Я)' },
                                { id: 'name_desc', label: 'По ФИО (Я–А)' },
                                { id: 'email_asc', label: 'По email' },
                            ].map((opt) => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => { setSortOrder(opt.id); setShowSortDropdown(false); }}
                                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${sortOrder === opt.id ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
                    {error}
                    <button type="button" onClick={() => dispatch(fetchAdminUsers())} className="ml-3 text-sm font-medium underline">
                        Повторить
                    </button>
                </div>
            )}

            {filteredUsers.length === 0 ? (
                <div className="mt-12 text-center py-16">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {searchQuery ? 'Ничего не найдено' : 'Нет пользователей'}
                    </h2>
                </div>
            ) : (
                <div className={`hidden md:block w-full ${showActionsPopup ? 'overflow-visible' : 'overflow-x-auto'}`}>
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-14" />
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Пользователь</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ID</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Контакты</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Роли</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Организация</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Действия</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {filteredUsers.map((u) => {
                                const isMenuOpen = showActionsPopup === u.id;
                                return (
                                    <tr
                                        key={u.id}
                                        className={`hover:bg-gray-50/50 cursor-pointer ${isMenuOpen ? 'relative z-30' : ''}`}
                                        onDoubleClick={(e) => {
                                            if (e.target.closest('.actions-dropdown')) return;
                                            openUserDetail(u.id);
                                        }}
                                    >
                                        <td className="px-4 py-3">
                                            <UserAvatar
                                                avatarUrl={u.avatar_url}
                                                firstName={u.first_name}
                                                lastName={u.last_name}
                                                size="md"
                                            />
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="text-sm font-semibold text-gray-900">{userFullName(u)}</div>
                                        </td>
                                        <td className="px-4 py-4 font-mono text-xs text-gray-600">{u.public_code || '—'}</td>
                                        <td className="px-4 py-4 text-sm text-gray-600">
                                            <div>{u.email}</div>
                                            <div className="text-gray-500">{u.phone || '—'}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {roleBadges(u).map((b) => (
                                                    <span key={b.label} className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${b.className}`}>
                                                        {b.label}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-sm text-gray-700">{u.organization_name || '—'}</td>
                                        <td className={`px-4 py-4 text-right ${isMenuOpen ? 'relative z-30' : ''}`}>
                                            <ActionsDropdown
                                                isOpen={isMenuOpen}
                                                onOpenChange={(next) => setShowActionsPopup(next ? u.id : null)}
                                                menuClassName="w-52 z-50"
                                                estimatedMenuHeight={120}
                                            >
                                                <ActionsDropdownItem onClick={() => { setShowActionsPopup(null); openUserDetail(u.id); }}>
                                                    Подробности
                                                </ActionsDropdownItem>
                                                <ActionsDropdownItem onClick={() => { setShowActionsPopup(null); openUserDetail(u.id, 'audit'); }}>
                                                    Журнал аудита
                                                </ActionsDropdownItem>
                                                <ActionsDropdownItem onClick={() => handleRevokeSessions(u.id)}>
                                                    Завершить все сессии
                                                </ActionsDropdownItem>
                                            </ActionsDropdown>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="md:hidden space-y-3 mt-4">
                {filteredUsers.map((u) => (
                    <div
                        key={u.id}
                        className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
                        onDoubleClick={() => openUserDetail(u.id)}
                    >
                        <div className="flex gap-3">
                            <UserAvatar avatarUrl={u.avatar_url} firstName={u.first_name} lastName={u.last_name} size="lg" />
                            <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-gray-900">{userFullName(u)}</h3>
                                <p className="text-xs font-mono text-gray-500 mt-0.5">ID {u.public_code}</p>
                                <p className="text-sm text-gray-600 mt-1">{u.email}</p>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {roleBadges(u).map((b) => (
                                        <span key={b.label} className={`inline-flex px-2 py-0.5 rounded-full text-xs ${b.className}`}>
                                            {b.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {selectedUserId && (
                <UserDetailModal
                    user={userDetail}
                    audit={userAudit}
                    auditLoading={auditLoading}
                    activeTab={detailTab}
                    auditPage={auditPage}
                    onTabChange={(tab) => {
                        setDetailTab(tab);
                        if (tab === 'audit' && selectedUserId) {
                            dispatch(fetchAdminUserAudit({ userId: selectedUserId, page: auditPage }));
                        }
                    }}
                    onAuditPageChange={loadAuditPage}
                    onClose={closeDetail}
                    formatAuditDate={formatAuditDate}
                    labelCategory={labelCategory}
                    labelEventType={labelEventType}
                    parseDetails={parseDetails}
                />
            )}
        </div>
    );
}
