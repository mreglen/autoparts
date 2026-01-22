import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchSellers } from '../../redux/slices/SellerSlice';

export default function SellersPage() {
    const dispatch = useDispatch();
    const [showDeletePopup, setShowDeletePopup] = useState(null);
    
    // Select data from Redux store
    const sellers = useSelector((state) => state.sellers.sellers);
    const loading = useSelector((state) => state.sellers.loading);
    const error = useSelector((state) => state.sellers.error);
    
    useEffect(() => {
        dispatch(fetchSellers());
    }, [dispatch]);

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
                <h2 className="text-2xl font-bold text-gray-800">Продавцы</h2>
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
                <div className="overflow-x-auto">
                    {/* Desktop table view */}
                    <table className="hidden sm:table min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    ФИО
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Организация
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Email
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Телефон
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sellers.map((seller) => (
                                <tr key={seller.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                            {seller.last_name} {seller.first_name}{seller.patronymic ? ` ${seller.patronymic}` : ''}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">
                                            {seller.organization_name || 'Не указана'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{seller.email}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{seller.phone}</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    {/* Mobile card view */}
                    <div className="sm:hidden space-y-4">
                        {sellers.map((seller) => (
                            <div key={seller.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                                <div className="mb-3">
                                    <h3 className="font-medium text-gray-900">
                                        {seller.last_name} {seller.first_name}{seller.patronymic ? ` ${seller.patronymic}` : ''}
                                    </h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Организация: {seller.organization_name || 'Не указана'}
                                    </p>
                                    <p className="text-sm text-gray-500 mt-1">{seller.email}</p>
                                    <p className="text-sm text-gray-500">{seller.phone}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}