// src/components/ProfileActions.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { requestPasswordReset, confirmPasswordReset } from '../../../redux/slices/AuthSlice';

export default function ProfileActions({ onEditProfile }) {
    const dispatch = useDispatch();
    const { user, loading, error } = useSelector((state) => state.auth);

    const [action, setAction] = useState('idle'); // 'idle' | 'changePassword' | 'verifyCode'
    const [formData, setFormData] = useState({
        password: '',
        password_repeat: '',
        code: '',
    });
    const [success, setSuccess] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordRepeat, setShowPasswordRepeat] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setSuccess('');
    };

    const handleSendCode = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.password_repeat) {
            return;
        }
        if (formData.password.length < 6) {
            return;
        }

        const result = await dispatch(
            requestPasswordReset(user.email)
        );

        if (requestPasswordReset.fulfilled.match(result)) {
            setAction('verifyCode');
            setSuccess('Код подтверждения отправлен на ваш email');
        }
    };

    const handleVerifyCode = async (e) => {
        e.preventDefault();
        if (!formData.code.trim()) return;

        const result = await dispatch(
            confirmPasswordReset({
                email: user.email,
                code: formData.code,
                new_password: formData.password,
            })
        );

        if (confirmPasswordReset.fulfilled.match(result)) {
            setSuccess('Пароль успешно изменён');
            setAction('idle');
            setFormData({ password: '', password_repeat: '', code: '' });
            setShowPassword(false);
            setShowPasswordRepeat(false);
        }
    };

    const reset = () => {
        setAction('idle');
        setFormData({ password: '', password_repeat: '', code: '' });
        setSuccess('');
        setShowPassword(false);
        setShowPasswordRepeat(false);
    };

    // Локальные проверки ошибок
    const hasPasswordMismatch = formData.password !== formData.password_repeat;
    const hasShortPassword = formData.password.length > 0 && formData.password.length < 6;
    const hasCodeEmpty = action === 'verifyCode' && !formData.code.trim();

    return (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Действия</h2>

            {action === 'idle' ? (
                <div className="space-y-3">
                    <button
                        onClick={() => {
                            setAction('idle');
                            onEditProfile?.();
                        }}
                        className="block w-full text-center px-4 py-2.5 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                    >
                        Редактировать профиль
                    </button>
                    <button
                        onClick={() => setAction('changePassword')}
                        className="block w-full text-center px-4 py-2.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                    >
                        Сменить пароль
                    </button>
                    <Link
                        to="/"
                        className="block w-full text-center px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Назад
                    </Link>
                </div>
            ) : action === 'changePassword' ? (
                <div>
                    <h3 className="text-md font-medium text-gray-800 mb-3">Новый пароль</h3>
                    {(hasPasswordMismatch || hasShortPassword) && (
                        <p className="text-sm text-red-600 mb-3">
                            {hasPasswordMismatch && "Пароли не совпадают"}
                            {hasShortPassword && "Пароль должен быть не менее 6 символов"}
                        </p>
                    )}
                    {success && <p className="text-sm text-green-600 mb-3">{success}</p>}
                    {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
                    <form onSubmit={handleSendCode} className="space-y-3">
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                placeholder="Новый пароль"
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm"
                                disabled={loading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                            >
                                {showPassword ? (
                                    <img src="/img/hide.svg" alt="Скрыть пароль" className="w-4 h-4 filter brightness-0 saturate-100 invert-45 sepia-0 saturate-0 hue-rotate-0deg brightness-60 contrast-105 transition-opacity duration-300 ease-in-out" />
                                ) : (
                                    <img src="/img/show.svg" alt="Показать пароль" className="w-4 h-4 filter brightness-0 saturate-100 invert-45 sepia-0 saturate-0 hue-rotate-0deg brightness-60 contrast-105 transition-opacity duration-300 ease-in-out" />
                                )}
                            </button>
                        </div>
                        <div className="relative">
                            <input
                                type={showPasswordRepeat ? 'text' : 'password'}
                                name="password_repeat"
                                placeholder="Повторите пароль"
                                value={formData.password_repeat}
                                onChange={handleChange}
                                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm"
                                disabled={loading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPasswordRepeat(!showPasswordRepeat)}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                                aria-label={showPasswordRepeat ? "Скрыть пароль" : "Показать пароль"}
                            >
                                {showPasswordRepeat ? (
                                    <img src="/img/hide.svg" alt="Скрыть пароль" className="w-4 h-4 filter brightness-0 saturate-100 invert-45 sepia-0 saturate-0 hue-rotate-0deg brightness-60 contrast-105 transition-opacity duration-300 ease-in-out" />
                                ) : (
                                    <img src="/img/show.svg" alt="Показать пароль" className="w-4 h-4 filter brightness-0 saturate-100 invert-45 sepia-0 saturate-0 hue-rotate-0deg brightness-60 contrast-105 transition-opacity duration-300 ease-in-out" />
                                )}
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="submit"
                                className="flex-1 px-3 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50"
                                disabled={loading || hasPasswordMismatch || hasShortPassword}
                            >
                                {loading ? 'Отправка...' : 'Отправить код'}
                            </button>
                            <button
                                type="button"
                                onClick={reset}
                                className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50"
                            >
                                Отмена
                            </button>
                        </div>
                    </form>
                </div>
            ) : action === 'verifyCode' ? (
                <div>
                    <h3 className="text-md font-medium text-gray-800 mb-3">Подтверждение</h3>
                    {hasCodeEmpty && (
                        <p className="text-sm text-red-600 mb-3">Введите код подтверждения</p>
                    )}
                    {success && <p className="text-sm text-green-600 mb-3">{success}</p>}
                    {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
                    <p className="text-sm text-gray-600 mb-3">
                        Код отправлен на ваш email. Введите его ниже.
                    </p>
                    <form onSubmit={handleVerifyCode} className="space-y-3">
                        <div>
                            <input
                                type="text"
                                name="code"
                                placeholder="Код подтверждения"
                                value={formData.code}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                disabled={loading}
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="submit"
                                className="flex-1 px-3 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50"
                                disabled={loading || hasCodeEmpty}
                            >
                                {loading ? 'Проверка...' : 'Подтвердить'}
                            </button>
                            <button
                                type="button"
                                onClick={reset}
                                className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50"
                            >
                                Отмена
                            </button>
                        </div>
                    </form>
                </div>
            ) : null}
        </div>
    );
}