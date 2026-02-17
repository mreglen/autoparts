import { useState, useEffect } from 'react';
import axios from 'axios';

const PermissionAssignmentModal = ({ 
    show, 
    employee, 
    onClose, 
    onSave, 
    loading, 
    saving, 
    token 
}) => {
    const [availablePermissions, setAvailablePermissions] = useState([]);
    const [employeePermissions, setEmployeePermissions] = useState([]);
    const [loadingPermissions, setLoadingPermissions] = useState(false);

    useEffect(() => {
        if (show && employee) {
            loadPermissions();
        }
    }, [show, employee]);

    const loadPermissions = async () => {
        try {
            setLoadingPermissions(true);
            
            // Load available permissions
            const permissionsResponse = await axios.get(`${process.env.REACT_APP_API_URL}/api/employees/permissions/all`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            setAvailablePermissions(permissionsResponse.data);

            // For now, we're not loading current permissions since the backend doesn't return them
            // We'll just initialize with empty array or implement a separate endpoint later
            setEmployeePermissions([]);
        } catch (error) {
            console.error('Error loading permissions:', error);
            alert('Ошибка при загрузке прав доступа');
        } finally {
            setLoadingPermissions(false);
        }
    };

    const togglePermission = (permissionId) => {
        setEmployeePermissions(prev => {
            if (prev.includes(permissionId)) {
                return prev.filter(id => id !== permissionId);
            } else {
                return [...prev, permissionId];
            }
        });
    };

    const handleSave = () => {
        onSave(employee, employeePermissions);
    };

    if (!show || !employee) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Назначение прав доступа - {employee.first_name} {employee.last_name}</h3>
                        <button 
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700 text-xl"
                        >
                            ✕
                        </button>
                    </div>
                    
                    {loadingPermissions || loading ? (
                        <div className="text-center py-8">
                            <p>Загрузка прав доступа...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {availablePermissions.map(permission => (
                                <div key={permission.id} className="flex items-center p-3 border rounded-lg">
                                    <input
                                        type="checkbox"
                                        id={`perm-${permission.id}`}
                                        checked={employeePermissions.includes(permission.id)}
                                        onChange={() => togglePermission(permission.id)}
                                        className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                        disabled={saving}
                                    />
                                    <label htmlFor={`perm-${permission.id}`} className="ml-3 flex-1">
                                        <div className="font-medium">{permission.name}</div>
                                        <div className="text-sm text-gray-500">{permission.code}</div>
                                    </label>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                            disabled={saving}
                        >
                            Отмена
                        </button>
                        <button
                            onClick={handleSave}
                            className={`px-4 py-2 rounded-lg text-white transition-colors ${saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                            disabled={saving}
                        >
                            {saving ? 'Сохранение...' : 'Сохранить права'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PermissionAssignmentModal;