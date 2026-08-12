import { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchSellers } from '../../redux/slices/SellerSlice';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import ActionsDropdown, { ActionsDropdownItem } from '../../components/ActionsDropdown/ActionsDropdown';

export default function SellersPage() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { isReady, user } = useAuthReady();
    const allSellers = useSelector((state) => state.sellers.sellers);
    const loading = useSelector((state) => state.sellers.loading);
    const error = useSelector((state) => state.sellers.error);

    const [showActionsPopup, setShowActionsPopup] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('name_asc');
    const [showSortDropdown, setShowSortDropdown] = useState(false);

    const sellers = useMemo(
        () => allSellers.filter((seller) => !seller.is_employee),
        [allSellers]
    );

    const filteredSellers = useMemo(() => {
        let list = [...sellers];
        const q = searchQuery.trim().toLowerCase();
        if (q) {
            list = list.filter((seller) => {
                const fullName = `${seller.last_name || ''} ${seller.first_name || ''} ${seller.patronymic || ''}`.toLowerCase();
                return (
                    fullName.includes(q)
                    || (seller.email || '').toLowerCase().includes(q)
                    || (seller.phone || '').toLowerCase().includes(q)
                    || (seller.organization_name || '').toLowerCase().includes(q)
                );
            });
        }
        if (sortOrder === 'name_asc' || sortOrder === 'name_desc') {
            list.sort((a, b) => {
                const aName = `${a.last_name || ''} ${a.first_name || ''}`.trim().toLowerCase();
                const bName = `${b.last_name || ''} ${b.first_name || ''}`.trim().toLowerCase();
                if (aName < bName) return sortOrder === 'name_asc' ? -1 : 1;
                if (aName > bName) return sortOrder === 'name_asc' ? 1 : -1;
                return 0;
            });
        } else if (sortOrder === 'org_asc') {
            list.sort((a, b) => String(a.organization_name || '').localeCompare(String(b.organization_name || ''), 'ru'));
        }
        return list;
    }, [sellers, searchQuery, sortOrder]);

    useEffect(() => {
        if (!isReady) return;
        if (!user?.is_admin) {
            navigate('/', { replace: true });
            return;
        }
        dispatch(fetchSellers());
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

    if (!isReady) {
        return <AuthLoadingScreen className="min-h-[16rem]" />;
    }

    if (!user?.is_admin) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Доступ запрещен</h2>
                    <p className="text-gray-600">У вас нет прав для просмотра этой страницы</p>
                </div>
            </div>
        );
    }

    if (loading && sellers.length === 0) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
            </div>
        );
    }

    const sellerFullName = (seller) =>
        `${seller.last_name} ${seller.first_name}${seller.patronymic ? ` ${seller.patronymic}` : ''}`;

    return (
        <div className="mt-4 sm:mt-5 px-4 sm:px-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                <h1 className="text-2xl font-bold text-gray-800">Продавцы</h1>
                <div className="text-left sm:text-right text-sm text-gray-500">
                    Всего: <span className="font-semibold text-gray-900">{sellers.length}</span>
                </div>
            </div>

            <div className="mb-6 flex flex-col md:flex-row gap-4 md:items-end">
                <div className="flex-1 max-w-md">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Поиск</label>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="ФИО, email, телефон, организация..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>
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
                                { id: 'org_asc', label: 'По организации' },
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
                <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center justify-between gap-3">
                    <span>{error}</span>
                    <button type="button" onClick={() => dispatch(fetchSellers())} className="text-sm font-medium text-red-800 underline">
                        Повторить
                    </button>
                </div>
            )}

            {filteredSellers.length === 0 ? (
                <div className="mt-12 text-center py-16 px-6">
                    <div className="bg-gray-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                        <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        {searchQuery ? 'Ничего не найдено' : 'Нет зарегистрированных продавцов'}
                    </h2>
                </div>
            ) : (
                <>
                    <div className={`hidden md:block w-full ${showActionsPopup ? 'overflow-visible' : 'overflow-x-auto'}`}>
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Продавец</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Организация</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Контакты</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Действия</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {filteredSellers.map((seller) => {
                                    const isMenuOpen = showActionsPopup === seller.id;
                                    return (
                                    <tr
                                        key={seller.id}
                                        className={`hover:bg-gray-50/50 ${isMenuOpen ? 'relative z-30' : ''}`}
                                    >
                                        <td className="px-4 py-4">
                                            <div className="text-sm font-semibold text-gray-900">{sellerFullName(seller)}</div>
                                            {seller.is_director && (
                                                <span className="inline-flex mt-1 px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-800">Директор</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-sm text-gray-700">{seller.organization_name || '—'}</td>
                                        <td className="px-4 py-4 text-sm text-gray-600">
                                            <div>{seller.email}</div>
                                            <div className="text-gray-500">{seller.phone}</div>
                                        </td>
                                        <td className={`px-4 py-4 text-right ${isMenuOpen ? 'relative z-30' : ''}`}>
                                            <ActionsDropdown
                                                isOpen={isMenuOpen}
                                                onOpenChange={(next) => setShowActionsPopup(next ? seller.id : null)}
                                                menuClassName="w-48 z-50"
                                                estimatedMenuHeight={56}
                                            >
                                                <ActionsDropdownItem
                                                    onClick={() => {
                                                        setShowActionsPopup(null);
                                                        navigate(`/sellers/${seller.id}/workspace`);
                                                    }}
                                                >
                                                    Рабочий стол
                                                </ActionsDropdownItem>
                                            </ActionsDropdown>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="md:hidden space-y-3">
                        {filteredSellers.map((seller) => (
                            <div key={seller.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                                <div className="flex justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-semibold text-gray-900 truncate">{sellerFullName(seller)}</h3>
                                        <p className="text-sm text-gray-600 mt-1">{seller.organization_name || 'Организация не указана'}</p>
                                        <p className="text-sm text-gray-500 mt-1">{seller.email}</p>
                                        <p className="text-sm text-gray-500">{seller.phone}</p>
                                        {/* Поле наценки убрано: редактирование наценки теперь только в `/admin/rossko/markup-settings`. */}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/sellers/${seller.id}/workspace`)}
                                        className="flex-shrink-0 px-3 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50"
                                    >
                                        Открыть
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
