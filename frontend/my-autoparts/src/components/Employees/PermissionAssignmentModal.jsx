import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
    fetchPermissions, 
    fetchEmployeePermissions, 
    saveEmployeePermissions 
} from '../../redux/slices/OrganizationSlice';

const PermissionAssignmentModal = ({ 
    show, 
    employee, 
    onClose
}) => {
    const dispatch = useDispatch();
    const [localPermissions, setLocalPermissions] = useState([]);
    
 
    const {
        permissions,
        loadingPermissions,
        employeePermissions,
        loadingEmployeePermissions,
        savingEmployeePermissions,
        permissionsError
    } = useSelector(state => state.organization);

    useEffect(() => {
        if (show && employee) {
            // Load available permissions and employee's current permissions
            dispatch(fetchPermissions());
            dispatch(fetchEmployeePermissions(employee.id));
        }
    }, [show, employee, dispatch]);

    // Sync local state with Redux state when employee permissions are loaded
    useEffect(() => {
        if (employee && employeePermissions[employee.id]) {
            setLocalPermissions(employeePermissions[employee.id]);
        }
    }, [employee, employeePermissions]);

    const togglePermission = (permissionId) => {
        setLocalPermissions(prev => {
            if (prev.includes(permissionId)) {
                return prev.filter(id => id !== permissionId);
            } else {
                return [...prev, permissionId];
            }
        });
    };

    const handleSave = async () => {
        if (!employee) return;
        
        const resultAction = await dispatch(saveEmployeePermissions({
            employeeId: employee.id,
            permissionIds: localPermissions
        }));
        
        if (saveEmployeePermissions.fulfilled.match(resultAction)) {
            onClose();
        } else {
            alert('Ошибка при сохранении прав: ' + (resultAction.payload || 'Неизвестная ошибка'));
        }
    };

    const isLoading = loadingPermissions || loadingEmployeePermissions;
    const isSaving = savingEmployeePermissions;

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
                    
                    {isLoading ? (
                        <div className="text-center py-8">
                            <p>Загрузка прав доступа...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {permissions.map(permission => (
                                <div key={permission.id} className="flex items-center p-3 border rounded-lg">
                                    <input
                                        type="checkbox"
                                        id={`perm-${permission.id}`}
                                        checked={localPermissions.includes(permission.id)}
                                        onChange={() => togglePermission(permission.id)}
                                        className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                        disabled={isSaving}
                                    />
                                    <label htmlFor={`perm-${permission.id}`} className="ml-3 flex-1">
                                        <div className="font-medium">{permission.name}</div>
                                    </label>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                            disabled={isSaving}
                        >
                            Отмена
                        </button>
                        <button
                            onClick={handleSave}
                            className={`px-4 py-2 rounded-lg text-white transition-colors ${isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                            disabled={isSaving}
                        >
                            {isSaving ? 'Сохранение...' : 'Сохранить права'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PermissionAssignmentModal;