import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchClients, createClient, deleteClient, selectClients, selectClientsLoading, selectClientsError, selectCreatingClient, selectDeletingClient, clearError } from '../../redux/slices/ClientSlice';

export default function ClientsPage() {
    const dispatch = useDispatch();
    const [showAddForm, setShowAddForm] = useState(false);
    const [showDeletePopup, setShowDeletePopup] = useState(null); // Store client ID for popup
    const [formData, setFormData] = useState({
        last_name: '',
        first_name: '',
        patronymic: '',
        email: '',
        phone: ''
    });
    const [errors, setErrors] = useState({});
    
    // Select data from Redux store
    const clients = useSelector(selectClients);
    const loading = useSelector(selectClientsLoading);
    const error = useSelector(selectClientsError);
    const creating = useSelector(selectCreatingClient);
    const deleting = useSelector(selectDeletingClient);
    const user = useSelector((state) => state.auth.user);

    useEffect(() => {
        dispatch(fetchClients());
    }, [dispatch]);

    // Handle error messages
    useEffect(() => {
        if (error) {
            // Error will be shown in modal now
            dispatch(clearError());
        }
    }, [error, dispatch]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};
        
        if (!formData.last_name.trim()) {
            newErrors.last_name = 'Фамилия обязательна';
        }
        
        if (!formData.first_name.trim()) {
            newErrors.first_name = 'Имя обязательно';
        }
        
        if (!formData.email.trim()) {
            newErrors.email = 'Email обязателен';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Неверный формат email';
        }
        
        if (!formData.phone.trim()) {
            newErrors.phone = 'Телефон обязателен';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }
        
        const clientData = {
            ...formData,
            organization_id: user.organization_id
        };
        
        dispatch(createClient(clientData)).then((result) => {
            if (createClient.fulfilled.match(result)) {
                // Reset form on success
                setFormData({
                    last_name: '',
                    first_name: '',
                    patronymic: '',
                    email: '',
                    phone: ''
                });
                setShowAddForm(false);
                setErrors({});
            }
        });
    };

    const handleDeleteClick = (clientId) => {
        setShowDeletePopup(clientId);
    };

    const confirmDelete = () => {
        if (showDeletePopup) {
            dispatch(deleteClient(showDeletePopup));
            setShowDeletePopup(null);
        }
    };

    const cancelDelete = () => {
        setShowDeletePopup(null);
    };

    // Close popup when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (showDeletePopup && !e.target.closest('.delete-popup-container')) {
                setShowDeletePopup(null);
            }
        };

        if (showDeletePopup) {
            document.addEventListener('click', handleClickOutside);
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [showDeletePopup]);

    if (loading && clients.length === 0) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Клиенты</h2>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    disabled={creating}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
                >
                    {creating ? 'Создание...' : (showAddForm ? 'Отмена' : 'Добавить клиента')}
                </button>
            </div>

            {showAddForm && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4">Добавить нового клиента</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Фамилия *
                            </label>
                            <input
                                type="text"
                                name="last_name"
                                value={formData.last_name}
                                onChange={handleInputChange}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.last_name ? 'border-red-500' : 'border-gray-300'}`}
                                placeholder="Введите фамилию"
                            />
                            {errors.last_name && (
                                <p className="mt-1 text-sm text-red-600">{errors.last_name}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Имя *
                            </label>
                            <input
                                type="text"
                                name="first_name"
                                value={formData.first_name}
                                onChange={handleInputChange}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.first_name ? 'border-red-500' : 'border-gray-300'}`}
                                placeholder="Введите имя"
                            />
                            {errors.first_name && (
                                <p className="mt-1 text-sm text-red-600">{errors.first_name}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Отчество
                            </label>
                            <input
                                type="text"
                                name="patronymic"
                                value={formData.patronymic}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Введите отчество"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email *
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                                placeholder="Введите email"
                            />
                            {errors.email && (
                                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Телефон *
                            </label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.phone ? 'border-red-500' : 'border-gray-300'}`}
                                placeholder="Введите телефон"
                            />
                            {errors.phone && (
                                <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAddForm(false);
                                    setFormData({
                                        last_name: '',
                                        first_name: '',
                                        patronymic: '',
                                        email: '',
                                        phone: ''
                                    });
                                    setErrors({});
                                }}
                                className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Отмена
                            </button>
                            <button
                                type="submit"
                                disabled={creating}
                                className="w-full sm:w-auto px-4 py-2 bg-blue-600 disabled:opacity-50 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                {creating ? 'Создание...' : 'Добавить клиента'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {clients.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-gray-500">Нет клиентов</p>
                    {!showAddForm && (
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="mt-4 text-blue-600 hover:text-blue-800 font-medium"
                        >
                            Добавить первого клиента
                        </button>
                    )}
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
                            {clients.map((client) => (
                                <tr key={client.id}>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                            {client.last_name} {client.first_name}{client.patronymic ? ` ${client.patronymic}` : ''}
                                        </div>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{client.email}</div>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{client.phone}</div>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="relative inline-block text-left delete-popup-container">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteClick(client.id); }}
                                                disabled={deleting}
                                                className="text-gray-600 hover:text-gray-800 text-xs sm:text-sm font-medium border-2 border-gray-400 rounded px-2 py-1 bg-transparent hover:bg-gray-50 transition-colors flex items-center gap-1 disabled:opacity-50"
                                            >
                                                Действия
                                                <img
                                                    src="/img/arrow_sm.svg"
                                                    alt=""
                                                    className={`w-3 h-3 transition-transform duration-200 filter brightness-0 ${showDeletePopup === client.id ? 'rotate-90' : ''}`}
                                                    style={{ filter: 'brightness(0) saturate(100%) invert(61%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(90%) contrast(89%)' }}
                                                />
                                            </button>
                                            
                                            {/* Popup confirmation */}
                                            {showDeletePopup === client.id && (
                                                <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10 actions-dropdown">
                                                    <div className="py-1">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); confirmDelete(); setShowDeletePopup(null); }}
                                                            disabled={deleting}
                                                            className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50"
                                                        >
                                                            {deleting ? 'Удаление...' : 'Удалить'}
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
                        {clients.map((client) => (
                            <div key={client.id} className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 shadow-sm">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-gray-900 truncate">
                                            {client.last_name} {client.first_name}{client.patronymic ? ` ${client.patronymic}` : ''}
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1 truncate">{client.email}</p>
                                        <p className="text-sm text-gray-500 truncate">{client.phone}</p>
                                    </div>
                                    <div className="relative delete-popup-container flex-shrink-0">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(client.id); }}
                                            disabled={deleting}
                                            className="text-gray-600 hover:text-gray-800 text-sm font-medium border-2 border-gray-400 rounded px-3 py-1 bg-transparent hover:bg-gray-50 transition-colors flex items-center gap-1 disabled:opacity-50"
                                        >
                                            Действия
                                            <img
                                                src="/img/arrow_sm.svg"
                                                alt=""
                                                className={`w-3 h-3 transition-transform duration-200 filter brightness-0 ${showDeletePopup === client.id ? 'rotate-90' : ''}`}
                                                style={{ filter: 'brightness(0) saturate(100%) invert(61%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(90%) contrast(89%)' }}
                                            />
                                        </button>
                                        
                                        {/* Mobile popup - positioned below button */}
                                        {showDeletePopup === client.id && (
                                            <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10 actions-dropdown">
                                                <div className="py-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); confirmDelete(); setShowDeletePopup(null); }}
                                                        disabled={deleting}
                                                        className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50"
                                                    >
                                                        {deleting ? 'Удаление...' : 'Удалить'}
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
        </div>
    );
}