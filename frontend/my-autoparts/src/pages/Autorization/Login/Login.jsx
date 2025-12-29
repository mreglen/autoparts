// src/pages/Authorization/Login/Login.jsx
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { login as loginThunk } from '../../../redux/slices/AuthSlice';

export default function Login() {
    const [loginValue, setLoginValue] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false); // <-- added
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { loading, error } = useSelector((state) => state.auth);

    const handleSubmit = (e) => {
        e.preventDefault();
        dispatch(loginThunk({ login: loginValue, password }))
            .unwrap()
            .then(() => {
                navigate('/');
            })
            .catch(() => { });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Вход</h2>
                <p className="text-gray-500 text-sm mt-1">Введите email или телефон и пароль</p>
            </div>

            {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
                    {error}
                </div>
            )}

            <div>

                <input
                    type="text"
                    value={loginValue}
                    onChange={(e) => setLoginValue(e.target.value)}
                    placeholder="Email или телефон"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    required
                />
            </div>
      
            <div className="relative">
                <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Пароль"
                    autoComplete="current-password"
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
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.234a1.5 1.5 0 012.108-.658l2.453 1.226a1.5 1.5 0 001.548 0l2.453-1.226a1.5 1.5 0 012.108.658 8.25 8.25 0 010 4.532 1.5 1.5 0 01-2.108.658l-2.453-1.226a1.5 1.5 0 00-1.548 0l-2.453 1.226a1.5 1.5 0 01-2.108-.658 8.25 8.25 0 010-4.532z" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    )}
                </button>
            </div>
            <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-60"
            >
                {loading ? 'Вход...' : 'Войти'}
            </button>

            {/* Ссылка на восстановление пароля */}
            <div className="text-center">
                <RouterLink
                    to="/auth/password-reset"
                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                    Забыли пароль?
                </RouterLink>
            </div>
        </form>
    );
}