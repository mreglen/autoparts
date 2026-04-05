// src/pages/Authorization/PasswordReset/PasswordReset.jsx
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { requestPasswordReset, confirmPasswordReset } from '../../../redux/slices/AuthSlice';

export default function PasswordReset() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { loading, error } = useSelector((state) => state.auth);

    const [step, setStep] = useState('email'); // 'email' | 'code'
    const [email, setEmail] = useState('');
    const [formData, setFormData] = useState({
        code: '',
        password: '',
        password_repeat: '',
    });
    const [success, setSuccess] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordRepeat, setShowPasswordRepeat] = useState(false);

    const handleEmailSubmit = (e) => {
        e.preventDefault();
        dispatch(requestPasswordReset(email))
            .unwrap()
            .then(() => {
                setStep('code');
                setSuccess('Код подтверждения отправлен на ваш email');
            });
    };

    const handleCodeSubmit = (e) => {
        e.preventDefault();
        if (formData.password !== formData.password_repeat) {
            dispatch({ type: 'auth/setError', payload: 'Пароли не совпадают' });
            return;
        }
        if (formData.password.length < 6) {
            dispatch({ type: 'auth/setError', payload: 'Пароль должен быть не менее 6 символов' });
            return;
        }

        dispatch(confirmPasswordReset({
            email,
            code: formData.code,
            new_password: formData.password,
        }))
        .unwrap()
        .then(() => {
            setSuccess('Пароль успешно изменён. Теперь войдите в аккаунт.');
            setTimeout(() => navigate('/auth'), 2000);
        });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'code') {
            const digits = value.replace(/\D/g, '').slice(0, 12);
            setFormData((prev) => ({ ...prev, code: digits }));
            return;
        }
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleCodePaste = (e) => {
        const text = e.clipboardData?.getData('text') ?? '';
        if (!/\d/.test(text)) return;
        e.preventDefault();
        const digits = text.replace(/\D/g, '').slice(0, 12);
        setFormData((prev) => ({ ...prev, code: digits }));
    };

    const hasPasswordMismatch = formData.password !== formData.password_repeat;
    const hasShortPassword = formData.password.length > 0 && formData.password.length < 6;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="p-8">
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">
                                {step === 'email' ? 'Восстановление пароля' : 'Новый пароль'}
                            </h2>
                            <p className="text-gray-500 text-sm mt-1">
                                {step === 'email'
                                    ? 'Введите email, указанный при регистрации'
                                    : 'Введите код из письма и новый пароль'
                                }
                            </p>
                        </div>

                        {(error || success) && (
                            <div className={`p-3 rounded-lg text-sm border ${error ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                {error || success}
                            </div>
                        )}

                        {step === 'email' ? (
                            <form onSubmit={handleEmailSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-60"
                                >
                                    {loading ? 'Отправка...' : 'Отправить код'}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleCodeSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Код подтверждения</label>
                                    <input
                                        type="text"
                                        name="code"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        autoComplete="one-time-code"
                                        value={formData.code}
                                        onChange={handleChange}
                                        onPaste={handleCodePaste}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Новый пароль</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            name="password"
                                            value={formData.password}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                                            required
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
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Повторите пароль</label>
                                    <div className="relative">
                                        <input
                                            type={showPasswordRepeat ? 'text' : 'password'}
                                            name="password_repeat"
                                            value={formData.password_repeat}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                                            required
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
                                </div>
                                {(hasPasswordMismatch || hasShortPassword) && (
                                    <p className="text-sm text-red-600">
                                        {hasPasswordMismatch && "Пароли не совпадают"}
                                        {hasShortPassword && "Пароль должен быть не менее 6 символов"}
                                    </p>
                                )}
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setStep('email')}
                                        className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                    >
                                        Назад
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading || hasPasswordMismatch || hasShortPassword}
                                        className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
                                    >
                                        {loading ? 'Сохранение...' : 'Сохранить'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>

                {/* Нижняя панель — как в Authorization.jsx */}
                <div className="bg-gray-50 px-8 py-4 text-center">
                    <p className="text-sm text-gray-600">
                        Помните пароль?{' '}
                        <RouterLink
                            to="/auth"
                            className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
                        >
                            Вернуться ко входу
                        </RouterLink>
                    </p>
                </div>
            </div>
        </div>
    );
}