// src/pages/Authorization/Registration/Registration.jsx
import { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
    setIsBuyer,
    updateField,
    updateCode,
    resetRegistration,
    sendVerificationCode,
    verifyEmailCode,
    completeRegistration,
    resetEmailVerificationError,
    setAddressError,
} from '../../../redux/slices/AuthSlice';
import { useNavigate } from 'react-router-dom';

export default function Registration() {
    const navigate = useNavigate();

    const {
        isBuyer,
        isSeller,
        formData,
        code,
        emailVerification,
        loading,
        error,
        addressError,
    } = useSelector((state) => state.auth);
    const dispatch = useDispatch();

    const [phoneError, setPhoneError] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [addressInput, setAddressInput] = useState('');
    const [emailError, setEmailError] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordRepeat, setShowPasswordRepeat] = useState(false);
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (formData.address_organization) {
            setAddressInput(formData.address_organization);
        }
    }, [formData.address_organization]);

    // Закрывать выпадающий список при клике вне его
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target) && inputRef.current !== e.target) {
                setSuggestions([]);
                setHighlightedIndex(-1);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    };

    // --- Dadata address ---
    const handleAddressChange = async (value) => {
        setAddressInput(value);
        dispatch(setAddressError(''));
        dispatch(updateField({ address_organization: value, addressData: null }));
        setHighlightedIndex(-1);
        if (!value || value.length < 3) {
            setSuggestions([]);
            return;
        }
        try {
            const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': 'Token a1a8fbcf263bb8a2e549b1aa7fe56c08c1a2da1d',
                },
                body: JSON.stringify({ query: value, count: 5 }),
            });
            if (!response.ok) {
                setSuggestions([]);
                return;
            }
            const result = await response.json();
            setSuggestions(Array.isArray(result.suggestions) ? result.suggestions : []);
        } catch (err) {
            setSuggestions([]);
        }
    };

    const selectAddress = (suggestion) => {
        setAddressInput(suggestion.value);
        setSuggestions([]);
        setHighlightedIndex(-1);
        dispatch(setAddressError(''));
        dispatch(updateField({
            address_organization: suggestion.value,
            addressData: suggestion.data,
        }));


        inputRef.current?.focus();
    };

    // --- Handlers ---
    const handleRoleSelect = (role) => dispatch(setIsBuyer(role === 'buyer'));
    const handleFieldChange = (field, value) => dispatch(updateField({ [field]: value }));

    const handlePhoneChange = (e) => {
        let inputValue = e.target.value;
        let digits = inputValue.replace(/[^\d+]/g, '');
        if (digits.startsWith('8')) digits = '+7' + digits.slice(1);
        else if (digits.startsWith('7') && !digits.startsWith('+')) digits = '+7' + digits.slice(1);
        else if (digits === '+') digits = '+7';
        else if (!digits.startsWith('+7')) {
            if (!digits.startsWith('+')) digits = '';
        }
        const cleanDigits = digits.replace(/\D/g, '');
        if (cleanDigits.length > 11) digits = '+7' + cleanDigits.slice(1, 11);
        let formatted = digits;
        if (digits.startsWith('+7')) {
            const rest = digits.slice(2);
            if (rest.length === 0) formatted = '+7';
            else if (rest.length <= 3) formatted = `+7 (${rest}`;
            else if (rest.length <= 6) formatted = `+7 (${rest.slice(0, 3)}) ${rest.slice(3)}`;
            else if (rest.length <= 8) formatted = `+7 (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6)}`;
            else if (rest.length <= 10) formatted = `+7 (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6, 8)}-${rest.slice(8)}`;
        }
        dispatch(updateField({ phone: formatted }));
        const pure = formatted.replace(/\D/g, '');
        setPhoneError(
            pure.length === 0 ? '' :
                pure.length === 11 && pure.startsWith('7') ? '' :
                    'Неверный формат телефона'
        );
    };

    const handleSendCode = () => {
        if (!formData.email) {
            dispatch({ type: 'auth/setError', payload: 'Укажите email' });
            return;
        }
        if (/\s/.test(formData.email)) {
            dispatch({ type: 'auth/setError', payload: 'Email не должен содержать пробелов' });
            return;
        }
        dispatch(sendVerificationCode(formData.email));
    };

    const handleVerifyCode = () => {
        if (!formData.email || !code) return;
        dispatch(verifyEmailCode({ email: formData.email, code }));
    };

    const handleResendCode = () => {
        dispatch(sendVerificationCode(formData.email));
    };

    const handleFinalSubmit = () => {
        const { email, password, password_repeat, first_name, last_name } = formData;
        if (!email || !password || !password_repeat || !first_name || !last_name) {
            dispatch({ type: 'auth/setError', payload: 'Заполните все обязательные поля' });
            return;
        }
        if (password !== password_repeat) {
            dispatch({ type: 'auth/setError', payload: 'Пароли не совпадают' });
            return;
        }
        if (emailVerification.status !== 'verified') {
            dispatch({ type: 'auth/setError', payload: 'Подтвердите email' });
            return;
        }

        if (isSeller) {
            if (!formData.name_organization) {
                dispatch({ type: 'auth/setError', payload: 'Укажите название организации' });
                return;
            }
            if (!formData.address_organization) {
                dispatch({ type: 'auth/setError', payload: 'Укажите адрес организации' });
                return;
            }
            const { city, street, house } = formData.addressData || {};
            if (!city || !street || !house) {
                dispatch({ type: 'auth/setError', payload: 'Адрес должен содержать город, улицу и дом' });
                return;
            }
        }

        dispatch(completeRegistration({
            ...formData,
            is_buyer: isBuyer,
            is_seller: isSeller,
        }))
            .unwrap()
            .then(() => {
                navigate('/');
            })
            .catch(() => { });
    };

    const getEmailFieldClass = () => {
        if (emailVerification.status === 'verified') return 'border-green-500';
        if (emailVerification.status === 'error') return 'border-red-500';
        return 'border-gray-300';
    };

    const showCodeInput = emailVerification.status === 'sent' || emailVerification.status === 'error';

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Регистрация</h2>
                <p className="text-gray-500 text-sm mt-1">
                    {isBuyer !== null ? 'Заполните данные' : 'Выберите тип аккаунта'}
                </p>
            </div>

            {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
                    {error}
                </div>
            )}

            {isBuyer === null ? (
                <div className="space-y-3">
                    <button type="button" onClick={() => handleRoleSelect('buyer')} className="w-full py-3 px-4 bg-white border border-gray-300 rounded-xl text-gray-800 font-medium hover:bg-gray-50 transition-colors shadow-sm">Покупатель</button>
                    <button type="button" onClick={() => handleRoleSelect('seller')} className="w-full py-3 px-4 bg-white border border-gray-300 rounded-xl text-gray-800 font-medium hover:bg-gray-50 transition-colors shadow-sm">Продавец</button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <input placeholder="Фамилия" value={formData.last_name} onChange={(e) => handleFieldChange('last_name', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" required />
                        <input placeholder="Имя" value={formData.first_name} onChange={(e) => handleFieldChange('first_name', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" required />
                        <input placeholder="Отчество (необязательно)" value={formData.patronymic} onChange={(e) => handleFieldChange('patronymic', e.target.value)} className="w-full col-span-2 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                    </div>

                    {/* Email */}
                    <div className="relative">
                        <div className="flex items-center">
                            <input
                                type="email"
                                placeholder="Email"
                                value={formData.email}
                                onChange={(e) => {
                                    const email = e.target.value;
                                    handleFieldChange('email', email);
                                    if (email === '') {
                                        setEmailError('');
                                    } else if (!validateEmail(email)) {
                                        setEmailError('Неверный формат email');
                                    } else {
                                        setEmailError('');
                                    }
                                    if (emailVerification.status) {
                                        dispatch(resetRegistration());
                                        setEmailError('');
                                    }
                                }}
                                className={`flex-1 px-4 py-2.5 rounded-l-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition border ${getEmailFieldClass()}`}
                                required
                            />
                            {emailVerification.status === 'verified' ? (
                                <button type="button" disabled className="ml-2 px-3 py-1.5 bg-green-100 text-green-800 rounded text-sm font-medium">Подтверждено</button>
                            ) : emailVerification.status === 'error' ? (
                                <button type="button" onClick={handleResendCode} disabled={loading} className="ml-2 px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:opacity-60">Ещё раз</button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleSendCode}
                                    disabled={loading || !formData.email || !!emailError}
                                    className="ml-2 px-3 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
                                >
                                    Отправить код
                                </button>
                            )}
                        </div>
                        {emailError && <p className="text-red-600 text-sm mt-1">{emailError}</p>}
                    </div>

                    {/* Code input */}
                    {showCodeInput && (
                        <div className="space-y-1">
                            <input
                                placeholder="Код подтверждения"
                                value={code}
                                onChange={(e) => {
                                    const newCode = e.target.value;
                                    dispatch(updateCode(newCode));
                                    if (emailVerification.status === 'error' && newCode.length > 0) {
                                        dispatch(resetEmailVerificationError());
                                    }
                                }}
                                className={`w-full px-4 py-2.5 text-center border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition ${emailVerification.status === 'error' ? 'border-red-500' : 'border-gray-300'}`}
                            />
                            {emailVerification.status !== 'error' && (
                                <button
                                    type="button"
                                    onClick={handleVerifyCode}
                                    disabled={loading || !code}
                                    className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                                >
                                    Проверить почту
                                </button>
                            )}
                        </div>
                    )}

                    {/* Phone */}
                    <input
                        type="tel"
                        placeholder="+7 (___) ___-__-__"
                        value={formData.phone}
                        onChange={handlePhoneChange}
                        className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition ${phoneError ? 'border-red-500' : 'border-gray-300'}`}
                        required
                    />
                    {phoneError && <p className="text-red-600 text-sm">{phoneError}</p>}

                    {/* Password */}
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Пароль"
                            value={formData.password}
                            onChange={(e) => handleFieldChange('password', e.target.value)}
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

                    {/* Password repeat */}
                    <div className="relative">
                        <input
                            type={showPasswordRepeat ? 'text' : 'password'}
                            placeholder="Повторите пароль"
                            value={formData.password_repeat}
                            onChange={(e) => handleFieldChange('password_repeat', e.target.value)}
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

                    {/* Password mismatch hint */}
                    {formData.password && formData.password_repeat && formData.password !== formData.password_repeat && (
                        <p className="text-sm text-red-600 mt-1">Пароли не совпадают</p>
                    )}

                    {isSeller && (
                        <>
                            <input
                                placeholder="Название организации"
                                value={formData.name_organization}
                                onChange={(e) => handleFieldChange('name_organization', e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                                required
                            />
                            {/* Адрес организации — улучшенная версия */}
                            <div className="relative" ref={dropdownRef}>
                                <input
                                    ref={inputRef}
                                    placeholder="Адрес организации (город, улица, дом)"
                                    value={addressInput}
                                    onChange={(e) => handleAddressChange(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (!suggestions.length) return;

                                        if (e.key === 'ArrowDown') {
                                            e.preventDefault();
                                            setHighlightedIndex((prev) =>
                                                prev < suggestions.length - 1 ? prev + 1 : prev
                                            );
                                        } else if (e.key === 'ArrowUp') {
                                            e.preventDefault();
                                            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
                                        } else if (e.key === 'Enter' && highlightedIndex >= 0) {
                                            e.preventDefault();
                                            selectAddress(suggestions[highlightedIndex]);
                                        } else if (e.key === 'Escape') {
                                            setSuggestions([]);
                                            setHighlightedIndex(-1);
                                        }
                                    }}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    required
                                />
                                {suggestions.length > 0 && (
                                    <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-auto">
                                        {suggestions.map((s, i) => (
                                            <li
                                                key={i}
                                                onClick={() => selectAddress(s)}
                                                onMouseEnter={() => setHighlightedIndex(i)}
                                                className={`px-4 py-2 cursor-pointer ${i === highlightedIndex
                                                    ? 'bg-indigo-100 text-indigo-800'
                                                    : 'hover:bg-gray-100'
                                                    }`}
                                            >
                                                {s.value}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            {addressError && (
                                <p className="text-red-600 text-sm mt-1">{addressError}</p>
                            )}
                        </>
                    )}

                    <div className="flex justify-between pt-2">
                        <button type="button" onClick={() => dispatch(resetRegistration())} className="text-gray-600 hover:text-gray-800 font-medium transition-colors">Назад</button>
                        <button
                            type="button"
                            onClick={handleFinalSubmit}
                            disabled={loading || emailVerification.status !== 'verified'}
                            className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 transition-colors"
                        >
                            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}