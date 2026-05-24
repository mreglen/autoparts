// src/pages/Authorization/Registration/Registration.jsx
import { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import SuccessNotification from '../../../components/UI/SuccessNotification';
import {
    setIsBuyer,
    updateField,
    updateCode,
    resetRegistration,
    sendVerificationCode,
    verifyEmailCode,
    completeRegistration,
    registerSeller,
    resetEmailVerificationError,
    setAddressError,
} from '../../../redux/slices/AuthSlice';
import { fetchCart } from '../../../redux/slices/CartSlice';
import { useNavigate } from 'react-router-dom';
import { trackFormField, trackFormSubmit } from '../../../utils/siteAnalytics';

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
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    // Add state for step management
    const [currentStep, setCurrentStep] = useState(1); // 1: personal info, 2: verification, 3: additional info
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

    // Effect to handle step navigation after email verification
    useEffect(() => {
        if (currentStep === 2 && emailVerification.status === 'verified') {
            setCurrentStep(3);
        }
    }, [emailVerification.status, currentStep]);

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
    const handleFieldChange = (field, value) => {
        const formId = isSeller ? 'seller_registration' : 'buyer_registration';
        trackFormField(formId, field);
        dispatch(updateField({ [field]: value }));
    };

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
        // Dispatch the verification action
        dispatch(verifyEmailCode({ email: formData.email, code }));
    };

    const handleResendCode = () => {
        dispatch(sendVerificationCode(formData.email));
    };

    const handleFinalSubmit = () => {
        const { email, first_name, last_name } = formData;
        if (!email || !first_name || !last_name) {
            dispatch({ type: 'auth/setError', payload: 'Заполните все обязательные поля' });
            return;
        }

        if (isSeller) {
            // Seller registration
            if (!formData.name_organization) {
                dispatch({ type: 'auth/setError', payload: 'Укажите название организации' });
                return;
            }
            if (!formData.description_organization) {
                dispatch({ type: 'auth/setError', payload: 'Укажите описание организации' });
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

            dispatch(registerSeller({
                last_name: formData.last_name,
                first_name: formData.first_name,
                patronymic: formData.patronymic,
                name_organization: formData.name_organization,
                description_organization: formData.description_organization,
                address_organization: formData.address_organization,
                phone: formData.phone,
                email: formData.email,
            }))
                .unwrap()
                .then(() => {
                    trackFormSubmit('seller_registration', [
                        'last_name',
                        'first_name',
                        'patronymic',
                        'name_organization',
                        'description_organization',
                        'address_organization',
                        'phone',
                        'email',
                    ]);
                    // Show success modal instead of alert
                    setShowSuccessModal(true);
                })
                .catch(() => { });
        } else {
            // Buyer registration
            const { password, password_repeat } = formData;
            if (!password || !password_repeat) {
                dispatch({ type: 'auth/setError', payload: 'Введите пароль' });
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

            dispatch(completeRegistration({
                ...formData,
                is_buyer: isBuyer,
                is_seller: isSeller,
            }))
                .unwrap()
                .then(() => {
                    trackFormSubmit('buyer_registration', [
                        'last_name',
                        'first_name',
                        'patronymic',
                        'email',
                        'phone',
                    ]);
                    dispatch(fetchCart());
                    navigate('/');
                })
                .catch(() => { });
        }
    };

    const getEmailFieldClass = () => {
        if (emailVerification.status === 'verified') return 'border-green-500';
        if (emailVerification.status === 'error') return 'border-red-500';
        return 'border-gray-300';
    };

    const showCodeInput = emailVerification.status === 'sent' || emailVerification.status === 'error';

    const VERIFICATION_CODE_LENGTH = 6;

    const applyVerificationDigits = (raw) => {
        const digits = String(raw).replace(/\D/g, '').slice(0, VERIFICATION_CODE_LENGTH);
        dispatch(updateCode(digits));
        requestAnimationFrame(() => {
            const focusIndex =
                digits.length >= VERIFICATION_CODE_LENGTH
                    ? VERIFICATION_CODE_LENGTH - 1
                    : digits.length;
            document.getElementById(`code-input-${focusIndex}`)?.focus();
        });
    };

    const handleCodeDigitChange = (index, e) => {
        const raw = e.target.value.replace(/\D/g, '');
        if (raw.length > 1) {
            applyVerificationDigits(raw);
            return;
        }
        const chars = Array.from(
            { length: VERIFICATION_CODE_LENGTH },
            (_, i) => code[i] || ''
        );
        chars[index] = raw;
        dispatch(updateCode(chars.join('')));
        if (raw && index < VERIFICATION_CODE_LENGTH - 1) {
            document.getElementById(`code-input-${index + 1}`)?.focus();
        }
    };

    const handleCodeDigitKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !(code[index] || '') && index > 0) {
            e.preventDefault();
            const chars = Array.from(
                { length: VERIFICATION_CODE_LENGTH },
                (_, i) => code[i] || ''
            );
            chars[index - 1] = '';
            dispatch(updateCode(chars.join('')));
            document.getElementById(`code-input-${index - 1}`)?.focus();
        }
    };

    const handleVerificationCodePaste = (e) => {
        const text = e.clipboardData?.getData('text') ?? '';
        if (!/\d/.test(text)) return;
        e.preventDefault();
        e.stopPropagation();
        applyVerificationDigits(text);
    };

    // Step navigation handlers
    const goToStep2 = () => {
        // Validate step 1 before proceeding
        if (!formData.first_name || !formData.last_name || !formData.email) {
            dispatch({ type: 'auth/setError', payload: 'Заполните все обязательные поля' });
            return;
        }
        if (!validateEmail(formData.email)) {
            dispatch({ type: 'auth/setError', payload: 'Неверный формат email' });
            return;
        }
        if (!formData.phone) {
            dispatch({ type: 'auth/setError', payload: 'Введите номер телефона' });
            return;
        }
        // Automatically send verification code when moving to step 2
        handleSendCode();
        setCurrentStep(2);
    };

    const goToStep1 = () => {
        setCurrentStep(1);
    };

    const goToStep3 = () => {
        // Navigate to step 3
        setCurrentStep(3);
    };

    const renderStep1 = () => (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <input placeholder="Фамилия" value={formData.last_name} onChange={(e) => handleFieldChange('last_name', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" required />
                <input placeholder="Имя" value={formData.first_name} onChange={(e) => handleFieldChange('first_name', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" required />
                <input placeholder="Отчество (необязательно)" value={formData.patronymic} onChange={(e) => handleFieldChange('patronymic', e.target.value)} className="w-full col-span-2 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
            </div>

            {/* Email */}
            <div className="relative">
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
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition ${getEmailFieldClass()}`}
                    required
                />
                {emailError && <p className="text-red-600 text-sm mt-1">{emailError}</p>}
            </div>

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

            <div className="flex justify-end pt-2">
                <button
                    type="button"
                    onClick={goToStep2}
                    className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 transition-colors"
                >
                    Далее
                </button>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-4">
            <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900">Подтверждение email</h3>
                <p className="text-gray-500 text-sm mt-1">Мы отправили код подтверждения на {formData.email}</p>
            </div>

            {/* Code input with 6 boxes */}
            <div className="space-y-4">
                <div className="flex justify-center space-x-2">
                    {Array.from({ length: VERIFICATION_CODE_LENGTH }, (_, index) => (
                        <input
                            key={index}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            autoComplete={index === 0 ? 'one-time-code' : 'off'}
                            maxLength={index === 0 ? VERIFICATION_CODE_LENGTH : 1}
                            value={code[index] || ''}
                            onChange={(e) => handleCodeDigitChange(index, e)}
                            onKeyDown={(e) => handleCodeDigitKeyDown(index, e)}
                            onPaste={handleVerificationCodePaste}
                            id={`code-input-${index}`}
                            className="w-12 h-12 text-center text-xl border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                            aria-label={`Цифра ${index + 1} кода`}
                        />
                    ))}
                </div>

                {emailVerification.status === 'error' && (
                    <p className="text-red-600 text-sm text-center">{error || 'Неверный код'}</p>
                )}

                <div className="flex justify-between items-center">
                    <button
                        type="button"
                        onClick={goToStep1}
                        className="text-gray-600 hover:text-gray-800 font-medium transition-colors"
                    >
                        Назад
                    </button>
                    
                    <div className="text-center">
                        <button
                            type="button"
                            onClick={handleResendCode}
                            disabled={loading}
                            className="text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors"
                        >
                            Не пришёл код? Отправить снова
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={handleVerifyCode}
                        disabled={loading || code.length !== 6}
                        className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                    >
                        Продолжить
                    </button>
                </div>
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className="space-y-4">
            {!isSeller ? (
                <>
                    {/* Password fields for buyer */}
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
                </>
            ) : (
                <>
                    {/* Organization fields for seller */}
                    <input
                        placeholder="Название организации"
                        value={formData.name_organization}
                        onChange={(e) => handleFieldChange('name_organization', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                        required
                    />
                    <textarea
                        placeholder="Описание организации"
                        value={formData.description_organization}
                        onChange={(e) => handleFieldChange('description_organization', e.target.value)}
                        rows="3"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition resize-none"
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
                <button
                    type="button"
                    onClick={goToStep2}
                    className="text-gray-600 hover:text-gray-800 font-medium transition-colors"
                >
                    Назад
                </button>
                <button
                    type="button"
                    onClick={handleFinalSubmit}
                    disabled={loading || emailVerification.status !== 'verified'}
                    className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 transition-colors"
                >
                    {loading ? (isSeller ? 'Отправка заявки...' : 'Регистрация...') : (isSeller ? 'Отправить заявку' : 'Зарегистрироваться')}
                </button>
            </div>
        </div>
    );

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
                <div>
                    {/* Progress indicator */}
                    <div className="flex justify-between mb-6">
                        <div className={`flex flex-col items-center ${currentStep >= 1 ? 'text-indigo-600' : 'text-gray-400'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${currentStep >= 1 ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>
                                1
                            </div>
                            <span className="text-xs">Данные</span>
                        </div>
                        <div className={`flex flex-col items-center ${currentStep >= 2 ? 'text-indigo-600' : 'text-gray-400'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${currentStep >= 2 ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>
                                2
                            </div>
                            <span className="text-xs">Подтверждение</span>
                        </div>
                        <div className={`flex flex-col items-center ${currentStep >= 3 ? 'text-indigo-600' : 'text-gray-400'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${currentStep >= 3 ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>
                                3
                            </div>
                            <span className="text-xs">Доп. инфо</span>
                        </div>
                    </div>

                    {/* Render current step */}
                    {currentStep === 1 && renderStep1()}
                    {currentStep === 2 && renderStep2()}
                    {currentStep === 3 && renderStep3()}
                </div>
            )}
            {showSuccessModal && (
                <SuccessNotification 
                    message="На ваш email отправлено подтверждение о регистрации как продавец. Ваша заявка находится на рассмотрении администратором. После проверки вы получите уведомление о результате модерации."
                    onClose={() => setShowSuccessModal(false)}
                    onConfirm={() => {
                        setShowSuccessModal(false);
                        navigate('/');
                    }}
                />
            )}
        </div>
    );
}