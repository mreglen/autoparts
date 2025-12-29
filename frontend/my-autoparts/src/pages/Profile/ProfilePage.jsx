import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { updateProfile } from '../../redux/slices/UserSlice';
import OrganizationCard from './OrganizationCard';
import ProfileActions from './ProfileActions/ProfileActions';

export default function ProfilePage() {
    const dispatch = useDispatch();
    const user = useSelector((state) => state.auth.user);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        last_name: user?.last_name || '',
        first_name: user?.first_name || '',
        patronymic: user?.patronymic || '',
    });

    if (!user) {
        return (
            <div className="max-w-2xl mx-auto px-3 sm:px-5 lg:px-7 py-12">
                <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-8 text-center">
                    <div className="text-indigo-600 mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Не авторизован</h2>
                    <p className="text-gray-600 mb-4">Пожалуйста, войдите в систему, чтобы увидеть свой профиль.</p>
                    <Link
                        to="/auth"
                        className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                    >
                        Войти
                    </Link>
                </div>
            </div>
        );
    }

    const role = user.is_admin ? 'Администратор' : user.is_seller ? 'Продавец' : user.is_buyer ? 'Покупатель' : '—';
    const roleColor = user.is_admin ? 'bg-purple-100 text-purple-800' : user.is_seller ? 'bg-red-100 text-red-800' : user.is_buyer ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';

    const handleEdit = () => {
        setFormData({
            last_name: user.last_name || '',
            first_name: user.first_name || '',
            patronymic: user.patronymic || '',
        });
        setIsEditing(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
    };

    const handleSave = async () => {
        const payload = {};
        if (formData.last_name !== undefined) payload.last_name = formData.last_name;
        if (formData.first_name !== undefined) payload.first_name = formData.first_name;
        if (formData.patronymic !== undefined) payload.patronymic = formData.patronymic;



        await dispatch(updateProfile(payload));
        setIsEditing(false);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const fullName = `${formData.last_name || ''} ${formData.first_name || ''} ${formData.patronymic || ''}`.trim();

    return (
        <div className="max-w-4xl mx-auto px-3 sm:px-5 lg:px-7 py-8">
            {/* Сетка: 2 колонки — личная инфа + действия */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Личная информация */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-md border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Личная информация
                    </h2>
                    <div className="space-y-4">
                        {isEditing ? (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Фамилия</label>
                                    <input
                                        name="last_name"
                                        value={formData.last_name}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Имя</label>
                                    <input
                                        name="first_name"
                                        value={formData.first_name}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Отчество</label>
                                    <input
                                        name="patronymic"
                                        value={formData.patronymic}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-start gap-3">
                                    <div className="bg-indigo-50 text-indigo-600 rounded-full p-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">ФИО</p>
                                        <p className="font-medium text-gray-900">{fullName || '—'}</p>
                                    </div>
                                </div>
                            </>
                        )}
                        <div className="flex items-start gap-3">
                            <div className="bg-indigo-50 text-indigo-600 rounded-full p-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a2 2 0 002.828 0L21 8M5 12v6a2 2 0 002 2h8a2 2 0 002-2v-6M5 12h14" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Email</p>
                                <p className="font-medium text-gray-900">{user.email || '—'}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="bg-indigo-50 text-indigo-600 rounded-full p-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.848.535l6.44 6.44a1 1 0 01.536.848v6.28a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7v6m0 0v6m0-6h6m-6 6H9" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Телефон</p>
                                <p className="font-medium text-gray-900">{user.phone || '—'}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="bg-indigo-50 text-indigo-600 rounded-full p-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Роль</p>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColor}`}>
                                    {role}
                                </span>
                            </div>
                        </div>
                    </div>
                    {isEditing ? (
                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                            >
                                Сохранить
                            </button>
                            <button
                                onClick={handleCancel}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                            >
                                Отмена
                            </button>
                        </div>
                    ) : null}
                </div>
                {/* Блок действий */}
                <ProfileActions onEditProfile={handleEdit} />
            </div>
            {/* Организация и склады — на всю ширину */}
            {user.is_seller && user.organization_id && (
                <div className="mt-6">
                    <OrganizationCard orgId={user.organization_id} />
                </div>
            )}
        </div>
    );
}