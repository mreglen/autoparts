import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { requestPasswordReset, confirmPasswordReset } from '../../redux/slices/AuthSlice';

const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

export default function ChangePasswordModal({ isOpen, onClose }) {
    const dispatch = useDispatch();
    const { user, loading, error } = useSelector((state) => state.auth);

    const [step, setStep] = useState('password');
    const [formData, setFormData] = useState({ password: '', password_repeat: '', code: '' });
    const [success, setSuccess] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordRepeat, setShowPasswordRepeat] = useState(false);

    const reset = () => {
        setStep('password');
        setFormData({ password: '', password_repeat: '', code: '' });
        setSuccess('');
        setShowPassword(false);
        setShowPasswordRepeat(false);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setSuccess('');
    };

    const handleSendCode = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.password_repeat || formData.password.length < 6) return;

        const result = await dispatch(requestPasswordReset(user.email));
        if (requestPasswordReset.fulfilled.match(result)) {
            setStep('code');
            setSuccess('Код отправлен на email');
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
            setTimeout(handleClose, 1200);
        }
    };

    if (!isOpen) return null;

    const hasPasswordMismatch = formData.password !== formData.password_repeat;
    const hasShortPassword = formData.password.length > 0 && formData.password.length < 6;
    const hasCodeEmpty = step === 'code' && !formData.code.trim();

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={handleClose}
        >
            <div
                className="w-full max-w-md rounded-2xl bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                    <h3 className="text-lg font-semibold text-gray-900">Смена пароля</h3>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        aria-label="Закрыть"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="px-5 py-4">
                    {step === 'password' && (
                        <>
                            <p className="mb-4 text-sm text-gray-500">
                                Введите новый пароль — на {user?.email} придёт код подтверждения
                            </p>
                            {(hasPasswordMismatch || hasShortPassword) && (
                                <p className="mb-3 text-sm text-red-600">
                                    {hasPasswordMismatch && 'Пароли не совпадают. '}
                                    {hasShortPassword && 'Минимум 6 символов.'}
                                </p>
                            )}
                            {success && <p className="mb-3 text-sm text-emerald-600">{success}</p>}
                            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
                            <form onSubmit={handleSendCode} className="space-y-3">
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        placeholder="Новый пароль"
                                        value={formData.password}
                                        onChange={handleChange}
                                        className={inputClass}
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                                        aria-label={showPassword ? 'Скрыть' : 'Показать'}
                                    >
                                        <img src={showPassword ? '/img/hide.svg' : '/img/show.svg'} alt="" className="h-4 w-4 opacity-60" />
                                    </button>
                                </div>
                                <div className="relative">
                                    <input
                                        type={showPasswordRepeat ? 'text' : 'password'}
                                        name="password_repeat"
                                        placeholder="Повторите пароль"
                                        value={formData.password_repeat}
                                        onChange={handleChange}
                                        className={inputClass}
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswordRepeat(!showPasswordRepeat)}
                                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                                        aria-label={showPasswordRepeat ? 'Скрыть' : 'Показать'}
                                    >
                                        <img
                                            src={showPasswordRepeat ? '/img/hide.svg' : '/img/show.svg'}
                                            alt=""
                                            className="h-4 w-4 opacity-60"
                                        />
                                    </button>
                                </div>
                                <div className="flex gap-2 pt-1">
                                    <button
                                        type="submit"
                                        disabled={loading || hasPasswordMismatch || hasShortPassword}
                                        className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        {loading ? 'Отправка...' : 'Получить код'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                        Отмена
                                    </button>
                                </div>
                            </form>
                        </>
                    )}

                    {step === 'code' && (
                        <>
                            <p className="mb-3 text-sm text-gray-500">Код отправлен на {user?.email}</p>
                            {hasCodeEmpty && <p className="mb-3 text-sm text-red-600">Введите код</p>}
                            {success && <p className="mb-3 text-sm text-emerald-600">{success}</p>}
                            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
                            <form onSubmit={handleVerifyCode} className="space-y-3">
                                <input
                                    type="text"
                                    name="code"
                                    placeholder="000000"
                                    value={formData.code}
                                    onChange={handleChange}
                                    className={inputClass}
                                    disabled={loading}
                                    autoComplete="one-time-code"
                                    inputMode="numeric"
                                />
                                <div className="flex gap-2">
                                    <button
                                        type="submit"
                                        disabled={loading || hasCodeEmpty}
                                        className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        {loading ? 'Проверка...' : 'Подтвердить'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setStep('password');
                                            setFormData((prev) => ({ ...prev, code: '' }));
                                        }}
                                        className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                        Назад
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
