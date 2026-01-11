// src/pages/Clients/ClientsPage.jsx
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';

export default function ClientsPage() {
    const { user, token } = useSelector((state) => state.auth);

    // Проверяем авторизацию
    if (!token || !user) {
        return <Navigate to="/auth" replace />;
    }

    return (
        <div className="max-w-4xl mx-auto px-3 sm:px-5 lg:px-7 py-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Клиенты</h1>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center">
                <div className="text-indigo-600 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Раздел в разработке</h2>
                <p className="text-gray-600 mb-4">Управление клиентами скоро будет доступно.</p>
                <div className="text-sm text-gray-500">
                    Здесь будет отображаться список клиентов вашей организации.
                </div>
            </div>
        </div>
    );
}
