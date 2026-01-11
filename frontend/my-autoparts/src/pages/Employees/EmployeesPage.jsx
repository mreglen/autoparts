// src/pages/Employees/EmployeesPage.jsx
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import EmployeesSection from '../Profile/EmployeesSection';

export default function EmployeesPage() {
    const user = useSelector((state) => state.auth.user);

    // Проверяем, что пользователь авторизован и имеет доступ к управлению сотрудниками
    if (!user) {
        return <Navigate to="/auth" replace />;
    }

    // Проверяем, что пользователь имеет организацию (только организации могут управлять сотрудниками)
    if (!user.organization_id) {
        return (
            <div className="max-w-4xl mx-auto px-3 sm:px-5 lg:px-7 py-8">
                <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center">
                    <div className="text-indigo-600 mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Нет доступа</h2>
                    <p className="text-gray-600 mb-4">Управление сотрудниками доступно только для организаций.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-3 sm:px-5 lg:px-7 py-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Сотрудники</h1>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                <EmployeesSection orgId={user.organization_id} />
            </div>
        </div>
    );
}
