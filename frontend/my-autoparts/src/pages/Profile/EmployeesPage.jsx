// src/pages/Profile/EmployeesPage.jsx
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    fetchOrganization,
    fetchEmployees,
    addEmployee,
    deleteEmployee,
    updateEmployee,
} from '../../redux/slices/OrganizationSlice';

export default function EmployeesPage() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    const { data: org, loading } = useSelector((state) => state.organization);
    const { employees, loadingEmployees, employeesError } = useSelector((state) => state.organization);
    
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        last_name: '',
        first_name: '',
        patronymic: '',
        email: '',
        phone: '',
        password: ''
    });
    const [editForm, setEditForm] = useState({});
    const [errors, setErrors] = useState({});

    // Проверяем права доступа - только директор может просматривать эту страницу
    useEffect(() => {
        if (!user?.is_director) {
            navigate('/profile');
        }
    }, [user, navigate]);

    // Загружаем данные организации и сотрудников при монтировании
    useEffect(() => {
        if (user?.organization_id) {
            dispatch(fetchOrganization(user.organization_id));
            dispatch(fetchEmployees(user.organization_id));
        }
    }, [dispatch, user?.organization_id]);

    if (!user?.is_director) {
        return null;
    }

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

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditForm(prev => ({ ...prev, [name]: value }));
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
        
        if (!formData.password.trim()) {
            newErrors.password = 'Пароль обязателен';
        } else if (formData.password.length < 6) {
            newErrors.password = 'Пароль должен быть не менее 6 символов';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }
        
        const employeeData = {
            ...formData,
            organization_id: user.organization_id
        };
        
        await dispatch(addEmployee({ orgId: user.organization_id, employeeData }));
        
        // Reset form on success
        setFormData({
            last_name: '',
            first_name: '',
            patronymic: '',
            email: '',
            phone: '',
            password: ''
        });
        setShowAddForm(false);
        setErrors({});
    };

    const startEditing = (emp) => {
        setEditingId(emp.id);
        setEditForm({
            last_name: emp.last_name || '',
            first_name: emp.first_name || '',
            patronymic: emp.patronymic || '',
            email: emp.email || '',
            phone: emp.phone || '',
            password: ''
        });
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditForm({});
    };

    const saveEdit = async () => {
        await dispatch(updateEmployee({ orgId: user.organization_id, userId: editingId, updateData: editForm }));
        setEditingId(null);
    };

    const handleDelete = (empId, empName) => {
        if (empId === user?.id) {
            alert('Вы не можете удалить самого себя.');
            return;
        }
        if (window.confirm(`Удалить сотрудника "${empName}"?`)) {
            dispatch(deleteEmployee({ orgId: user.organization_id, userId: empId }));
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Сотрудники</h2>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                    {showAddForm ? 'Отмена' : 'Добавить сотрудника'}
                </button>
            </div>

            {showAddForm && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4">Добавить нового сотрудника</h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Пароль *
                            </label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleInputChange}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
                                placeholder="Введите пароль"
                            />
                            {errors.password && (
                                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                            )}
                        </div>

                        <div className="md:col-span-2 flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAddForm(false);
                                    setFormData({
                                        last_name: '',
                                        first_name: '',
                                        patronymic: '',
                                        email: '',
                                        phone: '',
                                        password: ''
                                    });
                                    setErrors({});
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Отмена
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Добавить сотрудника
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {loadingEmployees ? (
                <div className="text-center py-12">
                    <p className="text-gray-500">Загрузка сотрудников...</p>
                </div>
            ) : employeesError ? (
                <div className="text-center py-12">
                    <p className="text-red-600">{employeesError}</p>
                </div>
            ) : employees.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-gray-500">Нет сотрудников</p>
                    {!showAddForm && (
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="mt-4 text-blue-600 hover:text-blue-800 font-medium"
                        >
                            Добавить первого сотрудника
                        </button>
                    )}
                </div>
            ) : (
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                ФИО
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Email
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Телефон
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Роль
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Действия
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {employees.map((emp) => {
                            const fullName = `${emp.last_name || ''} ${emp.first_name || ''} ${emp.patronymic || ''}`.trim();
                            const isEditing = editingId === emp.id;
                            
                            return (
                                <tr key={emp.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {isEditing ? (
                                            <div className="space-y-2">
                                                <input
                                                    type="text"
                                                    name="last_name"
                                                    value={editForm.last_name || ''}
                                                    onChange={handleEditChange}
                                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                    placeholder="Фамилия"
                                                />
                                                <input
                                                    type="text"
                                                    name="first_name"
                                                    value={editForm.first_name || ''}
                                                    onChange={handleEditChange}
                                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                    placeholder="Имя"
                                                />
                                                <input
                                                    type="text"
                                                    name="patronymic"
                                                    value={editForm.patronymic || ''}
                                                    onChange={handleEditChange}
                                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                    placeholder="Отчество"
                                                />
                                            </div>
                                        ) : (
                                            <div className="text-sm font-medium text-gray-900">
                                                {fullName}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {isEditing ? (
                                            <input
                                                type="email"
                                                name="email"
                                                value={editForm.email || ''}
                                                onChange={handleEditChange}
                                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                placeholder="Email"
                                            />
                                        ) : (
                                            <div className="text-sm text-gray-900">{emp.email}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {isEditing ? (
                                            <input
                                                type="tel"
                                                name="phone"
                                                value={editForm.phone || ''}
                                                onChange={handleEditChange}
                                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                placeholder="Телефон"
                                            />
                                        ) : (
                                            <div className="text-sm text-gray-900">{emp.phone}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">
                                            {emp.is_director ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    Директор
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                    Сотрудник
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {isEditing ? (
                                            <div className="flex justify-end space-x-2">
                                                <button
                                                    onClick={saveEdit}
                                                    className="text-green-600 hover:text-green-900 text-xs"
                                                >
                                                    Сохранить
                                                </button>
                                                <button
                                                    onClick={cancelEditing}
                                                    className="text-gray-600 hover:text-gray-900 text-xs"
                                                >
                                                    Отмена
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex justify-end space-x-2">
                                                {emp.id !== user?.id && (
                                                    <>
                                                        <button
                                                            onClick={() => startEditing(emp)}
                                                            className="text-blue-600 hover:text-blue-900 text-xs"
                                                        >
                                                            Редактировать
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(emp.id, fullName)}
                                                            className="text-red-600 hover:text-red-900 text-xs"
                                                        >
                                                            Удалить
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
}