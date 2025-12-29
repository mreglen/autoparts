// src/components/EmployeesSection.jsx
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    fetchEmployees,
    addEmployee,
    deleteEmployee,
    updateEmployee, // ← новый thunk
} from '../../redux/slices/OrganizationSlice';

export default function EmployeesSection({ orgId }) {
    const dispatch = useDispatch();
    const { employees, loadingEmployees, employeesError } = useSelector(state => state.organization);
    const currentUser = useSelector(state => state.auth.user);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState(null); // ← ID редактируемого сотрудника
    const [editForm, setEditForm] = useState({});

    const [newEmp, setNewEmp] = useState({
        last_name: '', first_name: '', patronymic: '', email: '', phone: '', password: ''
    });

    useEffect(() => {
        if (orgId) {
            dispatch(fetchEmployees(orgId));
        }
    }, [dispatch, orgId]);

    const handleAdd = async () => {
        await dispatch(addEmployee({ orgId, employeeData: newEmp }));
        setIsAdding(false);
        setNewEmp({ last_name: '', first_name: '', patronymic: '', email: '', phone: '', password: '' });
    };

    const handleDelete = (empId, empName) => {
        if (empId === currentUser?.id) {
            alert('Вы не можете удалить самого себя.');
            return;
        }
        if (window.confirm(`Удалить сотрудника "${empName}"?`)) {
            dispatch(deleteEmployee({ orgId, userId: empId }));
        }
    };

    const startEditing = (emp) => {
        setEditingId(emp.id);
        setEditForm({
            last_name: emp.last_name || '',
            first_name: emp.first_name || '',
            patronymic: emp.patronymic || '',
            email: emp.email || '',
            phone: emp.phone || '',
            password: '',
        });
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditForm({});
    };

    const saveEdit = async () => {
        await dispatch(updateEmployee({ orgId, userId: editingId, updateData: editForm }));
        setEditingId(null);
    };

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditForm(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="mt-6">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-md font-medium text-gray-800">Сотрудники</h3>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="text-sm text-indigo-600 hover:underline"
                >
                    {isAdding ? 'Отменить' : 'Добавить сотрудника'}
                </button>
            </div>

            {isAdding && (
                <div className="bg-gray-50 p-4 rounded-md space-y-2 mb-4">
                    {['last_name', 'first_name', 'patronymic', 'email', 'phone', 'password'].map(field => (
                        <input
                            key={field}
                            name={field}
                            value={newEmp[field]}
                            onChange={e => setNewEmp(prev => ({ ...prev, [e.target.name]: e.target.value }))}
                            placeholder={field}
                            className="w-full text-sm px-2 py-1 border rounded"
                        />
                    ))}
                    <button
                        onClick={handleAdd}
                        className="px-3 py-1 bg-indigo-600 text-white text-sm rounded"
                    >
                        Сохранить
                    </button>
                </div>
            )}

            {loadingEmployees ? (
                <p>Загрузка сотрудников...</p>
            ) : employeesError ? (
                <p className="text-red-600">{employeesError}</p>
            ) : (
                <ul className="space-y-3">
                    {employees.map(emp => {
                        const fullName = `${emp.last_name || ''} ${emp.first_name || ''} ${emp.patronymic || ''}`.trim();
                        const isEditing = editingId === emp.id;

                        return (
                            <li key={emp.id} className="flex flex-col gap-2 p-3 bg-gray-50 rounded-md">
                                {isEditing ? (
                                    <>
                                        {['last_name', 'first_name', 'patronymic', 'email', 'phone'].map(field => (
                                            <input
                                                key={field}
                                                name={field}
                                                value={editForm[field] || ''}
                                                onChange={handleEditChange}
                                                className="text-sm px-2 py-1 border rounded"
                                                placeholder={field}
                                            />
                                        ))}
                                        {/* Поле для сброса пароля */}
                                        <input
                                            name="password"
                                            type="password"
                                            value={editForm.password || ''}
                                            onChange={handleEditChange}
                                            placeholder="Новый пароль (оставьте пустым, чтобы не менять)"
                                            className="text-sm px-2 py-1 border rounded"
                                        />
                                        <div className="flex gap-2">
                                            <button onClick={saveEdit} className="text-xs px-2 py-1 bg-green-600 text-white rounded">
                                                Сохранить
                                            </button>
                                            <button onClick={cancelEditing} className="text-xs px-2 py-1 border border-gray-400 rounded">
                                                Отмена
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="font-medium">{fullName}</span>
                                                {emp.is_director && (
                                                    <span className="ml-2 text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full">
                                                        Директор
                                                    </span>
                                                )}
                                                <div className="text-gray-500 text-xs mt-1">{emp.email} | {emp.phone}</div>
                                            </div>
                                            {emp.id !== currentUser?.id && (
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => startEditing(emp)}
                                                        className="text-blue-600 hover:text-blue-800 text-xs"
                                                    >
                                                        Редактировать
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(emp.id, fullName)}
                                                        className="text-red-600 hover:text-red-800 text-xs"
                                                    >
                                                        Удалить
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}