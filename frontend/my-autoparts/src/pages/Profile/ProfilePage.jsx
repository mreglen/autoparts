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
            <div className="max-w-2xl mx-auto px-2 sm:px-3 lg:px-4 py-12">
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

    let role = 'Покупатель';
    let roleColor = 'bg-blue-100 text-blue-800';

    if (user.is_admin) {
        role = 'Администратор';
        roleColor = 'bg-purple-100 text-purple-800';
    } else if (user.is_seller) {
        role = 'Продавец';
        roleColor = 'bg-red-100 text-red-800';
    }

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
        <>
            {/* Личная информация и действия на одном уровне */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Личная информация */}
                <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 w-full">
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
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
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
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
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

            {/* Организация и склады */}
            {user.is_seller && user.organization_id && (
                <OrganizationCard orgId={user.organization_id} />
            )}
        </>
    );
}