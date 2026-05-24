import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchEmployees, addEmployee as createEmployee, updateEmployee, deleteEmployee } from '../../redux/slices/OrganizationSlice';
import PermissionAssignmentModal from '../../components/Employees/PermissionAssignmentModal';
import ActionsDropdown, { ActionsDropdownItem } from '../../components/ActionsDropdown/ActionsDropdown';

const EmployeesPage = () => {
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  const { employees, loadingEmployees, employeesError } = useSelector(state => state.organization);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
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

  // Close dropdown when clicking outside (same as SellersPage)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openDropdownId && !e.target.closest('.actions-popup-container')) {
        setOpenDropdownId(null);
      }
    };
    if (openDropdownId) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openDropdownId]);

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

  const openDeleteModal = (empId, empName) => {
    setEmployeeToDelete({ id: empId, name: empName });
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setEmployeeToDelete(null);
  };

  const confirmDelete = async () => {
    if (!employeeToDelete) return;
    try {
      await dispatch(deleteEmployee({ orgId: user.organization_id, userId: employeeToDelete.id }));
      closeDeleteModal();
    } catch (error) {
      console.error('Ошибка удаления сотрудника:', error);
      alert('Ошибка удаления сотрудника: ' + (error.message || 'Неизвестная ошибка'));
    }
  };

  const renderEmployeeActions = (emp, fullName, containerExtraClass = '') => {
    if (emp.id === user?.id) return null;
    const isOpen = openDropdownId === emp.id;
    return (
      <ActionsDropdown
        containerClassName={`relative actions-popup-container actions-dropdown ${containerExtraClass}`.trim()}
        isOpen={isOpen}
        onOpenChange={(next) => setOpenDropdownId(next ? emp.id : null)}
        menuClassName="w-52 z-50"
        estimatedMenuHeight={200}
      >
        <ActionsDropdownItem
          onClick={() => {
            startEditing(emp);
            setOpenDropdownId(null);
          }}
        >
          Редактировать
        </ActionsDropdownItem>
        <ActionsDropdownItem
          onClick={() => {
            openPermissionModal(emp);
            setOpenDropdownId(null);
          }}
        >
          Назначить права
        </ActionsDropdownItem>
        <ActionsDropdownItem
          danger
          className="border-t border-gray-100"
          onClick={() => {
            openDeleteModal(emp.id, fullName);
            setOpenDropdownId(null);
          }}
        >
          Удалить
        </ActionsDropdownItem>
      </ActionsDropdown>
    );
  };

  const employeeCount = employees?.length ?? 0;

  return (
    <div className="mt-4 sm:mt-5 px-4 sm:px-0">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Сотрудники</h1>
          {!loadingEmployees && !employeesError && (
            <p className="mt-1 text-sm text-gray-500">
              {employeeCount > 0 ? `${employeeCount} в организации` : 'Управление доступом сотрудников'}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setFormData({
              last_name: '',
              first_name: '',
              patronymic: '',
              email: '',
              phone: '',
              password: '',
            });
            setErrors({});
            setShowAddForm(true);
          }}
          className="w-full rounded-lg bg-indigo-600 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-indigo-700 sm:w-auto sm:px-4 sm:py-2 sm:text-sm"
        >
          Добавить сотрудника
        </button>
      </div>

      {loadingEmployees ? (
        <div className="mt-8 flex flex-col items-center justify-center py-16 px-6">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
            <svg
              className="h-10 w-10 animate-spin text-indigo-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <p className="text-base text-gray-600">Загрузка сотрудников...</p>
        </div>
      ) : employeesError ? (
        <div className="mt-8 text-center py-16 px-6">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
            <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-red-600">{employeesError}</p>
        </div>
      ) : employees.length === 0 ? (
        <div className="mt-12 text-center py-16 px-6">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Сотрудников пока нет</h2>
          <p className="mb-6 text-base text-gray-600">Добавьте первого сотрудника и назначьте права доступа</p>
          {!showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="inline-flex min-h-[48px] items-center rounded-lg bg-indigo-600 px-5 py-3 text-base font-medium text-white hover:bg-indigo-700"
            >
              Добавить первого сотрудника
            </button>
          )}
        </div>
      ) : (
        <>
          <div
            className={`hidden md:block rounded-xl border border-gray-200 bg-white shadow-sm ${
              openDropdownId ? 'overflow-visible' : 'overflow-hidden'
            }`}
          >
            <table className="min-w-full">
              <thead className="border-b border-gray-100 bg-gray-50/80">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    ФИО
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Телефон
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Роль
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const fullName = `${emp.last_name || ''} ${emp.first_name || ''} ${emp.patronymic || ''}`.trim();
                  return (
                    <tr
                      key={emp.id}
                      className="group border-b border-gray-100 transition-all duration-200 hover:bg-gray-50/50"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-sm font-semibold text-indigo-700">
                            {(emp.first_name?.[0] || emp.last_name?.[0] || '?').toUpperCase()}
                          </div>
                          <div className="text-sm font-semibold text-gray-900">{fullName || '—'}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{emp.email}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{emp.phone}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {emp.is_director ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                            Директор
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
                            Сотрудник
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        {renderEmployeeActions(emp, fullName)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-4">
            {employees.map((emp) => {
              const fullName = `${emp.last_name || ''} ${emp.first_name || ''} ${emp.patronymic || ''}`.trim();
              return (
                <div
                  key={emp.id}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-base font-semibold text-indigo-700">
                        {(emp.first_name?.[0] || emp.last_name?.[0] || '?').toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words font-semibold text-gray-900">{fullName || '—'}</h3>
                        <p className="mt-1 text-sm text-gray-500">{emp.email}</p>
                        <p className="text-sm text-gray-500">{emp.phone}</p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        emp.is_director ? 'bg-green-100 text-green-800' : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      {emp.is_director ? 'Директор' : 'Сотрудник'}
                    </span>
                  </div>
                  <div className="flex justify-end border-t border-gray-100 pt-3">
                    {renderEmployeeActions(emp, fullName, '')}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {/* Permission Assignment Modal */}
      <PermissionAssignmentModal
        show={showPermissionModal}
        employee={selectedEmployee}
        onClose={() => {
          setShowPermissionModal(false);
          setSelectedEmployee(null);
        }}
      />
      {/* Add Employee Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl">
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Добавить нового сотрудника</h3>
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
                      password: '',
                    });
                    setErrors({});
                  }}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Закрыть"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
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
                    className={`w-full rounded-lg border px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 ${errors.last_name ? 'border-red-500' : 'border-gray-300'}`}
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
                    className={`w-full rounded-lg border px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 ${errors.first_name ? 'border-red-500' : 'border-gray-300'}`}
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
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
                    className={`w-full rounded-lg border px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
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
                    className={`w-full rounded-lg border px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 ${errors.phone ? 'border-red-500' : 'border-gray-300'}`}
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
                    className={`w-full rounded-lg border px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="Введите пароль"
                  />
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
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
                    className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className={`w-full rounded-lg px-4 py-2 transition-colors sm:w-auto ${isCreating ? 'cursor-not-allowed bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'} text-white`}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl">
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Редактировать сотрудника</h3>
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
                      password: '',
                    });
                    setErrors({});
                  }}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Закрыть"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
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
                    className={`w-full rounded-lg border px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 ${errors.last_name ? 'border-red-500' : 'border-gray-300'}`}
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
                    className={`w-full rounded-lg border px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 ${errors.first_name ? 'border-red-500' : 'border-gray-300'}`}
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
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
                    className={`w-full rounded-lg border px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
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
                    className={`w-full rounded-lg border px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 ${errors.phone ? 'border-red-500' : 'border-gray-300'}`}
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
                    className={`w-full rounded-lg border px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="Новый пароль (если нужно изменить)"
                  />
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
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
                    className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700 sm:w-auto"
                  >
                    Сохранить изменения
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {showDeleteModal && employeeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-red-100 rounded-full p-3">
                <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-center text-gray-900 mb-2">
              Удалить сотрудника?
            </h3>
            <p className="text-center text-gray-600 mb-6">
              Вы уверены, что хотите удалить сотрудника <strong>"{employeeToDelete.name}"</strong>? Это действие нельзя отменить.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={closeDeleteModal}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={confirmDelete}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeesPage;