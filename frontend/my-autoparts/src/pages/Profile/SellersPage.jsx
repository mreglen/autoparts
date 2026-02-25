import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchSellers } from '../../redux/slices/SellerSlice';
import { apiRequest } from '../../utils/apiClient';
import SellerDashboardModal from './SellerDashboardModal';

export default function SellersPage() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = useSelector((state) => state.auth);
    const [showActionsPopup, setShowActionsPopup] = useState(null);
    const [selectedSeller, setSelectedSeller] = useState(null);
    const [showDashboardModal, setShowDashboardModal] = useState(false);
    const [sellerStats, setSellerStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);
    
    // Select data from Redux store
    const allSellers = useSelector((state) => state.sellers.sellers);
    
    // Filter sellers to only show those who are not employees
    const sellers = allSellers.filter(seller => !seller.is_employees || seller.is_employees === false);
    const loading = useSelector((state) => state.sellers.loading);
    const error = useSelector((state) => state.sellers.error);
    
    // Check admin rights and fetch data
    useEffect(() => {
        if (!user?.is_admin) {
            navigate('/', { replace: true });
        } else {
            dispatch(fetchSellers());
        }
    }, [user, navigate, dispatch]);

    const handleActionsClick = (sellerId) => {
        setShowActionsPopup(showActionsPopup === sellerId ? null : sellerId);
    };

    const handleViewDashboard = async (seller) => {
        setSelectedSeller(seller);
        setShowDashboardModal(true);
        setLoadingStats(true);
        setShowActionsPopup(null);
        
        try {
            const stats = await apiRequest(`/admin/sellers/${seller.id}/dashboard`);
            setSellerStats(stats);
        } catch (err) {
            console.error('Failed to load seller dashboard:', err);
        } finally {
            setLoadingStats(false);
        }
    };

    const handleCloseModal = () => {
        setShowDashboardModal(false);
        setSelectedSeller(null);
        setSellerStats(null);
    };

    // Close popup when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (showActionsPopup && !e.target.closest('.actions-popup-container')) {
                setShowActionsPopup(null);
            }
        };

        if (showActionsPopup) {
            document.addEventListener('click', handleClickOutside);
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [showActionsPopup]);
    
    // If not admin, show access denied
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Продавцы</h2>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
                    {error}
                </div>
            )}

            {sellers.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-gray-500">Нет зарегистрированных продавцов</p>
                </div>
            ) : (
                <div className="w-full">
                    {/* Desktop table view */}
                    <table className="hidden sm:table w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    ФИО
                                </th>
                                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Организация
                                </th>
                                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Email
                                </th>
                                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Телефон
                                </th>
                                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Действия
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sellers.map((seller) => (
                                <tr key={seller.id}>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                            {seller.last_name} {seller.first_name}{seller.patronymic ? ` ${seller.patronymic}` : ''}
                                        </div>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">
                                            {seller.organization_name || 'Не указана'}
                                        </div>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{seller.email}</div>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{seller.phone}</div>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="relative inline-block text-left actions-popup-container">
                                            <button
                                                onClick={() => handleActionsClick(seller.id)}
                                                className="text-gray-600 hover:text-gray-800 text-xs sm:text-sm font-medium border-2 border-gray-400 rounded px-2 py-1 bg-transparent hover:bg-gray-50 transition-colors flex items-center gap-1"
                                            >
                                                Действия
                                                <img
                                                    src="/img/arrow_sm.svg"
                                                    alt=""
                                                    className={`w-3 h-3 transition-transform duration-200 filter brightness-0 ${showActionsPopup === seller.id ? 'rotate-90' : ''}`}
                                                    style={{ filter: 'brightness(0) saturate(100%) invert(61%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(90%) contrast(89%)' }}
                                                />
                                            </button>
                                            
                                            {/* Popup with View button */}
                                            {showActionsPopup === seller.id && (
                                                <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10 actions-dropdown">
                                                    <div className="py-1">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleViewDashboard(seller); }}
                                                            className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50 hover:text-gray-900"
                                                        >
                                                            Просмотреть
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    {/* Mobile card view */}
                    <div className="sm:hidden space-y-4">
                        {sellers.map((seller) => (
                            <div key={seller.id} className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 shadow-sm">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-gray-900 truncate">
                                            {seller.last_name} {seller.first_name}{seller.patronymic ? ` ${seller.patronymic}` : ''}
                                        </h3>
                                        <p className="text-sm text-gray-600 mt-1 truncate">
                                            Организация: {seller.organization_name || 'Не указана'}
                                        </p>
                                        <p className="text-sm text-gray-500 mt-1 truncate">{seller.email}</p>
                                        <p className="text-sm text-gray-500 truncate">{seller.phone}</p>
                                    </div>
                                    <div className="relative actions-popup-container flex-shrink-0">
                                        <button
                                            onClick={() => handleActionsClick(seller.id)}
                                            className="text-gray-600 hover:text-gray-800 text-sm font-medium border-2 border-gray-400 rounded px-3 py-1 bg-transparent hover:bg-gray-50 transition-colors flex items-center gap-1"
                                        >
                                            Действия
                                            <img
                                                src="/img/arrow_sm.svg"
                                                alt=""
                                                className={`w-3 h-3 transition-transform duration-200 filter brightness-0 ${showActionsPopup === seller.id ? 'rotate-90' : ''}`}
                                                style={{ filter: 'brightness(0) saturate(100%) invert(61%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(90%) contrast(89%)' }}
                                            />
                                        </button>
                                        
                                        {/* Mobile popup - positioned below button */}
                                        {showActionsPopup === seller.id && (
                                            <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10 actions-dropdown">
                                                <div className="py-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleViewDashboard(seller); }}
                                                        className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50 hover:text-gray-900"
                                                    >
                                                        Просмотреть
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Dashboard Modal */}
            <SellerDashboardModal
                isOpen={showDashboardModal}
                onClose={handleCloseModal}
                seller={selectedSeller}
                stats={sellerStats}
                loading={loadingStats}
            />
        </div>
    );
}