import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchEmployees, addEmployee as createEmployee, updateEmployee, deleteEmployee } from '../../redux/slices/OrganizationSlice';
import PermissionAssignmentModal from '../../components/Employees/PermissionAssignmentModal';

const EmployeesPage = () => {
    const dispatch = useDispatch();
    const { user } = useSelector(state => state.auth);
    const { employees, loadingEmployees, employeesError } = useSelector(state => state.organization);

    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [openDropdownId, setOpenDropdownId] = useState(null);
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [savingPermissions, setSavingPermissions] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);
    
    const [formData, setFormData] = useState({
        last_name: '',
        first_name: '',
        patronymic: '',
        email: '',
        phone: '',
        password: ''
    });
    
    const [errors, setErrors] = useState({});
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        if (user && user.organization_id) {
            dispatch(fetchEmployees(user.organization_id));
        }
    }, [dispatch, user]);

    const validateForm = (data) => {
        const newErrors = {};
        if (!data.last_name?.trim()) newErrors.last_name = 'Фамилия обязательна';
        if (!data.first_name?.trim()) newErrors.first_name = 'Имя обязательно';
        if (!data.email?.trim()) newErrors.email = 'Email обязателен';
        else if (!/\S+@\S+\.\S+/.test(data.email)) newErrors.email = 'Неверный формат email';
        if (!data.phone?.trim()) newErrors.phone = 'Телефон обязателен';
        if (!data.password?.trim() && !editingId) newErrors.password = 'Пароль обязателен';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm(formData)) {
            return;
        }

        setIsCreating(true);
        try {
            const employeeData = {
                ...formData,
            };
            
            await dispatch(createEmployee({ orgId: user.organization_id, employeeData })).unwrap();
            setFormData({
                last_name: '',
                first_name: '',
                patronymic: '',
                email: '',
                phone: '',
                password: ''
            });
            setErrors({});
            setShowAddForm(false);
        } catch (error) {
            console.error('Ошибка создания сотрудника:', error);
            alert('Ошибка создания сотрудника: ' + (error.message || 'Неизвестная ошибка'));
        } finally {
            setIsCreating(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const startEditing = (employee) => {
        setFormData({
            last_name: employee.last_name || '',
            first_name: employee.first_name || '',
            patronymic: employee.patronymic || '',
            email: employee.email || '',
            phone: employee.phone || '',
            password: '' // Password is optional when editing
        });
        setEditingId(employee.id);
        setShowEditForm(true); // Show the edit modal instead of inline editing
    };

    const saveEdit = async () => {
        if (!validateForm(formData)) {
            return;
        }

        try {
            await dispatch(updateEmployee({
                orgId: user.organization_id,
                userId: editingId,
                updateData: formData
            })).unwrap();
            setEditingId(null);
            setFormData({
                last_name: '',
                first_name: '',
                patronymic: '',
                email: '',
                phone: '',
                password: ''
            });
            setShowEditForm(false);
        } catch (error) {
            console.error('Ошибка обновления сотрудника:', error);
            alert('Ошибка обновления сотрудника: ' + (error.message || 'Неизвестная ошибка'));
        }
    };

    const openPermissionModal = (employee) => {
        setSelectedEmployee(employee);
        setShowPermissionModal(true);
    };

    const savePermissions = async (employeeId, permissionIds) => {
        setSavingPermissions(true);
        try {
            // Permission assignment functionality is not implemented in the OrganizationSlice yet
            // This would be implemented in the future with a proper API endpoint
            console.log('Assigning permissions', employeeId, permissionIds);
            setShowPermissionModal(false);
            setSelectedEmployee(null);
        } catch (error) {
            console.error('Ошибка назначения прав:', error);
            alert('Ошибка назначения прав: ' + (error.message || 'Неизвестная ошибка'));
        } finally {
            setSavingPermissions(false);
        }
    };

    const handleDelete = async (empId, empName) => {
        if (!window.confirm(`Удалить сотрудника "${empName}"?`)) {
            return;
        }
        
        try {
            await dispatch(deleteEmployee({ orgId: user.organization_id, userId: empId }));
        } catch (error) {
            console.error('Ошибка удаления сотрудника:', error);
            alert('Ошибка удаления сотрудника: ' + (error.message || 'Неизвестная ошибка'));
        }
    };

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Сотрудники</h2>
                <button
                    onClick={() => {
                        setFormData({
                            last_name: '',
                            first_name: '',
                            patronymic: '',
                            email: '',
                            phone: '',
                            password: ''
                        });
                        setErrors({});
                        setShowAddForm(true);
                    }}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                    Добавить сотрудника
                </button>
            </div>


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
                <div className="-mx-4 sm:-mx-6 lg:-mx-8">
                    <div className="inline-block min-w-full py-2 align-middle">
                        {/* Desktop table view */}
                        <table className="hidden sm:table w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        ФИО
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Email
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Телефон
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Пароль
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Роль
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                                        Действия
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {employees.map((emp) => {
                                    const fullName = `${emp.last_name || ''} ${emp.first_name || ''} ${emp.patronymic || ''}`.trim();
                                    
                                    return (
                                        <tr key={emp.id}>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {fullName}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{emp.email}</div>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{emp.phone}</div>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">••••••••</div>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
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
                                            <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium w-32">
                                                <div className="relative flex justify-end">
                                                    {emp.id !== user?.id && (
                                                        <>
                                                            <button
                                                                onClick={() => setOpenDropdownId(openDropdownId === emp.id ? null : emp.id)}
                                                                className="text-gray-600 hover:text-gray-800 text-sm font-medium border-2 border-gray-400 rounded px-2 py-1 bg-transparent hover:bg-gray-50 transition-colors flex items-center gap-1 text-nowrap"
                                                            >
                                                                Действия
                                                                <svg className="w-3 h-3 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ filter: 'brightness(0) saturate(100%) invert(61%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(90%) contrast(89%)' }}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                </svg>
                                                            </button>
                                                            
                                                            {openDropdownId === emp.id && (
                                                                <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                                                                    <button
                                                                        onClick={() => {
                                                                            startEditing(emp);
                                                                            setOpenDropdownId(null);
                                                                        }}
                                                                        className="block w-full text-left px-4 py-2 text-sm text-black hover:bg-gray-100"
                                                                    >
                                                                        Редактировать
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            openPermissionModal(emp);
                                                                            setOpenDropdownId(null);
                                                                        }}
                                                                        className="block w-full text-left px-4 py-2 text-sm text-black hover:bg-gray-100"
                                                                    >
                                                                        Назначить права
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            handleDelete(emp.id, fullName);
                                                                            setOpenDropdownId(null);
                                                                        }}
                                                                        className="block w-full text-left px-4 py-2 text-sm text-black hover:bg-gray-100 border-t border-gray-200"
                                                                    >
                                                                        Удалить
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Mobile card view */}
            <div className="sm:hidden space-y-4">
                {employees.map((emp) => {
                    const fullName = `${emp.last_name || ''} ${emp.first_name || ''} ${emp.patronymic || ''}`.trim();
                    
                    return (
                        <div key={emp.id} className="bg-white p-4 rounded-lg border border-gray-200">
                            <>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-medium text-gray-900">{fullName}</h3>
                                        <p className="text-sm text-gray-500">{emp.email}</p>
                                        <p className="text-sm text-gray-500">{emp.phone}</p>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            {emp.is_director ? 'Директор' : 'Сотрудник'}
                                        </span>
                                        <div className="relative mt-2">
                                            {emp.id !== user?.id && (
                                                <>
                                                    <button
                                                        onClick={() => setOpenDropdownId(openDropdownId === emp.id ? null : emp.id)}
                                                        className="text-gray-600 hover:text-gray-800 text-sm font-medium border border-gray-400 rounded px-2 py-1"
                                                    >
                                                        Действия
                                                    </button>
                                                    
                                                    {openDropdownId === emp.id && (
                                                        <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                                                            <button
                                                                onClick={() => {
                                                                    startEditing(emp);
                                                                    setOpenDropdownId(null);
                                                                }}
                                                                className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-100"
                                                            >
                                                                Редактировать
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    openPermissionModal(emp);
                                                                    setOpenDropdownId(null);
                                                                }}
                                                                className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-100"
                                                            >
                                                                Назначить права
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    handleDelete(emp.id, fullName);
                                                                    setOpenDropdownId(null);
                                                                }}
                                                                className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-100 border-t border-gray-200"
                                                            >
                                                                Удалить
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        </div>
                    );
                })}
            </div>

            {/* Permission Assignment Modal */}
            <PermissionAssignmentModal
                show={showPermissionModal}
                employee={selectedEmployee}
                onClose={() => setShowPermissionModal(false)}
                onSave={savePermissions}
                loading={false}
                saving={savingPermissions}
                token={localStorage.getItem('token')}
            />
            
            {/* Add Employee Modal */}
            {showAddForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold">Добавить нового сотрудника</h3>
                                <button 
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
                                    className="text-gray-500 hover:text-gray-700 text-xl"
                                >
                                    ✕
                                </button>
                            </div>
                            
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

                                <div className="flex justify-end gap-3 pt-4">
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
                                        disabled={isCreating}
                                        className={`px-4 py-2 rounded-lg transition-colors ${isCreating ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
                                    >
                                        {isCreating ? 'Создание...' : 'Добавить сотрудника'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Edit Employee Modal */}
            {showEditForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold">Редактировать сотрудника</h3>
                                <button 
                                    onClick={() => {
                                        setShowEditForm(false);
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
                                    className="text-gray-500 hover:text-gray-700 text-xl"
                                >
                                    ✕
                                </button>
                            </div>
                            
                            <form onSubmit={(e) => { e.preventDefault(); saveEdit(); }} className="space-y-4">
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
                                        Пароль
                                    </label>
                                    <input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
                                        placeholder="Новый пароль (если нужно изменить)"
                                    />
                                    {errors.password && (
                                        <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                                    )}
                                </div>

                                <div className="flex justify-end gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowEditForm(false);
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
                                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                                    >
                                        Сохранить изменения
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default EmployeesPage;