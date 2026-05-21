import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { requestPasswordReset, confirmPasswordReset, logout } from '../../../redux/slices/AuthSlice';
import ConfirmationModal from '../../../components/ConfirmationModal/ConfirmationModal';

const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

function ActionButton({ onClick, icon, title, subtitle, variant = 'default' }) {
    const variants = {
        default: 'border-gray-200 bg-white hover:bg-gray-50 text-gray-800',
        primary: 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800',
        danger: 'border-red-200 bg-red-50 hover:bg-red-100 text-red-800',
    };
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${variants[variant]}`}
        >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-gray-100">
                {icon}
            </span>
            <span className="min-w-0">
                <span className="block text-sm font-medium">{title}</span>
                {subtitle && <span className="block text-xs text-gray-500 mt-0.5">{subtitle}</span>}
            </span>
        </button>
    );
}

export default function ProfileActions({ onEditProfile, isEditingProfile }) {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user, loading, error } = useSelector((state) => state.auth);

    const [action, setAction] = useState('idle');
    const [formData, setFormData] = useState({
        password: '',
        password_repeat: '',
        code: '',
    });
    const [success, setSuccess] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordRepeat, setShowPasswordRepeat] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);

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
            setAction('verifyCode');
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

    const hasPasswordMismatch = formData.password !== formData.password_repeat;
    const hasShortPassword = formData.password.length > 0 && formData.password.length < 6;
    const hasCodeEmpty = action === 'verifyCode' && !formData.code.trim();

    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <h3 className="text-base font-semibold text-gray-900">Безопасность</h3>
            <p className="mt-1 text-sm text-gray-500">Пароль и выход из аккаунта</p>

            {action === 'idle' && (
                <div className="mt-5 space-y-3">
                    {!isEditingProfile && (
                        <ActionButton
                            variant="primary"
                            title="Изменить ФИО"
                            subtitle="Фамилия, имя, отчество"
                            onClick={() => onEditProfile?.()}
                            icon={
                                <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            }
                        />
                    )}
                    <ActionButton
                        title="Сменить пароль"
                        subtitle="Подтверждение по email"
                        onClick={() => setAction('changePassword')}
                        icon={
                            <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        }
                    />
                    <div className="border-t border-gray-100 pt-3">
                        <ActionButton
                            variant="danger"
                            title="Выйти из аккаунта"
                            onClick={() => setShowLogoutModal(true)}
                            icon={
                                <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                            }
                        />
                    </div>
                </div>
            )}

            {action === 'changePassword' && (
                <div className="mt-5">
                    <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">1</span>
                        Новый пароль
                    </div>
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
                                <img src={showPasswordRepeat ? '/img/hide.svg' : '/img/show.svg'} alt="" className="h-4 w-4 opacity-60" />
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={loading || hasPasswordMismatch || hasShortPassword}
                                className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {loading ? 'Отправка...' : 'Получить код'}
                            </button>
                            <button
                                type="button"
                                onClick={reset}
                                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                            >
                                Отмена
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {action === 'verifyCode' && (
                <div className="mt-5">
                    <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">2</span>
                        Код из письма
                    </div>
                    {hasCodeEmpty && <p className="mb-3 text-sm text-red-600">Введите код</p>}
                    {success && <p className="mb-3 text-sm text-emerald-600">{success}</p>}
                    {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
                    <p className="mb-3 text-sm text-gray-500">Код отправлен на {user.email}</p>
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
                                onClick={reset}
                                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                            >
                                Отмена
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <ConfirmationModal
                isOpen={showLogoutModal}
                onClose={() => setShowLogoutModal(false)}
                onConfirm={() => {
                    setShowLogoutModal(false);
                    dispatch(logout());
                    navigate('/', { replace: true });
                }}
                title="Выход из аккаунта"
                message="Вы действительно хотите выйти?"
                confirmText="Выйти"
                cancelText="Отмена"
                danger
            />
        </section>
    );
}
