import { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import SuccessNotification from '../UI/SuccessNotification';
import {
    setIsBuyer,
    updateField,
    updateCode,
    resetRegistration,
    sendVerificationCode,
    verifyEmailCode,
    registerSeller,
    setAddressError,
} from '../../redux/slices/AuthSlice';
import { trackFormField, trackFormSubmit } from '../../utils/siteAnalytics';
import RegistrationLegalConsent from '../Legal/RegistrationLegalConsent';

const VERIFICATION_CODE_LENGTH = 6;
const inputClass =
    'w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition';

export default function SellerRegistrationForm({ id = 'seller-registration' }) {
    const dispatch = useDispatch();
    const {
        formData,
        code,
        emailVerification,
        loading,
        error,
        addressError,
        user,
        token,
    } = useSelector((state) => state.auth);

    const [phoneError, setPhoneError] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [addressInput, setAddressInput] = useState('');
    const [emailError, setEmailError] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [acceptedLegalConsent, setAcceptedLegalConsent] = useState(false);
    const [showLegalErrors, setShowLegalErrors] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [initialized, setInitialized] = useState(false);
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);

    const isLoggedIn = Boolean(token && user);

    useEffect(() => {
        if (isLoggedIn) return;
        dispatch(resetRegistration());
        dispatch(setIsBuyer(false));
        setInitialized(true);
    }, [dispatch, isLoggedIn]);

    useEffect(() => {
        if (formData.address_organization) {
            setAddressInput(formData.address_organization);
        }
    }, [formData.address_organization]);

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

    useEffect(() => {
        if (currentStep === 2 && emailVerification.status === 'verified') {
            setCurrentStep(3);
        }
    }, [emailVerification.status, currentStep]);

    if (isLoggedIn) {
        return (
            <div id={id} className="rounded-2xl border border-gray-200/90 bg-white p-6 shadow-xl shadow-gray-900/5 ring-1 ring-gray-100 sm:p-8">
                <h3 className="text-xl font-bold text-gray-900">Вы уже вошли в аккаунт</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    Заявка на регистрацию продавца доступна только гостям. Если нужно подключить магазин к текущему
                    аккаунту — напишите в поддержку или зайдите в настройки организации.
                </p>
                <Link
                    to="/profile"
                    className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:from-blue-700 hover:to-indigo-700"
                >
                    Перейти в профиль
                </Link>
            </div>
        );
    }

    if (!initialized) return null;

    const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const handleFieldChange = (field, value) => {
        trackFormField('seller_registration', field);
        dispatch(updateField({ [field]: value }));
    };

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
                    Accept: 'application/json',
                    Authorization: 'Token a1a8fbcf263bb8a2e549b1aa7fe56c08c1a2da1d',
                },
                body: JSON.stringify({ query: value, count: 5 }),
            });
            if (!response.ok) {
                setSuggestions([]);
                return;
            }
            const result = await response.json();
            setSuggestions(Array.isArray(result.suggestions) ? result.suggestions : []);
        } catch {
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

    const handlePhoneChange = (e) => {
        let digits = e.target.value.replace(/[^\d+]/g, '');
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
                pure.length === 11 && pure.startsWith('79') ? '' :
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

    const handleFinalSubmit = () => {
        const { email, first_name, last_name } = formData;
        if (!email || !first_name || !last_name) {
            dispatch({ type: 'auth/setError', payload: 'Заполните все обязательные поля' });
            return;
        }
        if (!acceptedLegalConsent) {
            setShowLegalErrors(true);
            dispatch({
                type: 'auth/setError',
                payload:
                    'Дайте согласие на обработку персональных данных и подтвердите ознакомление с политикой конфиденциальности',
            });
            return;
        }
        setShowLegalErrors(false);

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
        const phoneDigits = String(formData.phone || '').replace(/\D/g, '');
        if (!(phoneDigits.length === 11 && phoneDigits.startsWith('79'))) {
            setPhoneError('Неверный формат телефона');
            dispatch({ type: 'auth/setError', payload: 'Введите мобильный номер в формате +7 (9XX) XXX-XX-XX' });
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
                setShowSuccessModal(true);
            })
            .catch(() => { });
    };

    const applyVerificationDigits = (raw) => {
        const digits = String(raw).replace(/\D/g, '').slice(0, VERIFICATION_CODE_LENGTH);
        dispatch(updateCode(digits));
        requestAnimationFrame(() => {
            const focusIndex =
                digits.length >= VERIFICATION_CODE_LENGTH
                    ? VERIFICATION_CODE_LENGTH - 1
                    : digits.length;
            document.getElementById(`seller-code-input-${focusIndex}`)?.focus();
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
            document.getElementById(`seller-code-input-${index + 1}`)?.focus();
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
            document.getElementById(`seller-code-input-${index - 1}`)?.focus();
        }
    };

    const handleVerificationCodePaste = (e) => {
        const text = e.clipboardData?.getData('text') ?? '';
        if (!/\d/.test(text)) return;
        e.preventDefault();
        e.stopPropagation();
        applyVerificationDigits(text);
    };

    const goToStep2 = () => {
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
        const phoneDigits = String(formData.phone).replace(/\D/g, '');
        if (!(phoneDigits.length === 11 && phoneDigits.startsWith('79'))) {
            setPhoneError('Неверный формат телефона');
            dispatch({ type: 'auth/setError', payload: 'Введите мобильный номер в формате +7 (9XX) XXX-XX-XX' });
            return;
        }
        handleSendCode();
        setCurrentStep(2);
    };

    const stepLabel = (n, label) => (
        <div className={`flex flex-col items-center ${currentStep >= n ? 'text-indigo-600' : 'text-gray-400'}`}>
            <div className={`mb-1 flex h-8 w-8 items-center justify-center rounded-full ${currentStep >= n ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>
                {n}
            </div>
            <span className="text-xs">{label}</span>
        </div>
    );

    return (
        <div id={id} className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-xl shadow-gray-900/5 ring-1 ring-gray-100">
            <div className="border-b border-gray-100 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 px-6 py-5 sm:px-8">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-800 shadow-sm">
                    Для магазинов
                </div>
                <h3 className="mt-3 text-2xl font-bold text-gray-900">Регистрация продавца</h3>
                <p className="mt-1 text-sm text-gray-600">
                    Оставьте заявку — после проверки администратором придёт письмо с доступом в кабинет.
                </p>
            </div>

            <div className="space-y-6 p-6 sm:p-8">
                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div className="mb-2 flex justify-between">
                    {stepLabel(1, 'Данные')}
                    {stepLabel(2, 'Email')}
                    {stepLabel(3, 'Организация')}
                </div>

                {currentStep === 1 && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <input placeholder="Фамилия" value={formData.last_name} onChange={(e) => handleFieldChange('last_name', e.target.value)} className={inputClass} required />
                            <input placeholder="Имя" value={formData.first_name} onChange={(e) => handleFieldChange('first_name', e.target.value)} className={inputClass} required />
                            <input placeholder="Отчество (необязательно)" value={formData.patronymic} onChange={(e) => handleFieldChange('patronymic', e.target.value)} className={`${inputClass} sm:col-span-2`} />
                        </div>
                        <div>
                            <input
                                type="email"
                                placeholder="Email"
                                value={formData.email}
                                onChange={(e) => {
                                    const email = e.target.value;
                                    handleFieldChange('email', email);
                                    if (!email) setEmailError('');
                                    else if (!validateEmail(email)) setEmailError('Неверный формат email');
                                    else setEmailError('');
                                    if (emailVerification.status) {
                                        dispatch(resetRegistration());
                                        dispatch(setIsBuyer(false));
                                        setEmailError('');
                                    }
                                }}
                                className={`${inputClass} ${emailVerification.status === 'verified' ? 'border-green-500' : emailVerification.status === 'error' ? 'border-red-500' : ''}`}
                                required
                            />
                            {emailError && <p className="mt-1 text-sm text-red-600">{emailError}</p>}
                        </div>
                        <div>
                            <input
                                type="tel"
                                placeholder="+7 (___) ___-__-__"
                                value={formData.phone}
                                onChange={handlePhoneChange}
                                className={`${inputClass} ${phoneError ? 'border-red-500' : ''}`}
                                required
                            />
                            {phoneError && <p className="mt-1 text-sm text-red-600">{phoneError}</p>}
                        </div>
                        <div className="flex justify-end pt-1">
                            <button
                                type="button"
                                onClick={goToStep2}
                                className="rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                            >
                                Далее
                            </button>
                        </div>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="space-y-4">
                        <div>
                            <h4 className="text-lg font-medium text-gray-900">Подтверждение email</h4>
                            <p className="mt-1 text-sm text-gray-500">Мы отправили код на {formData.email}</p>
                        </div>
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
                                    id={`seller-code-input-${index}`}
                                    className="h-12 w-12 rounded-lg border border-gray-300 text-center text-xl outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                                    aria-label={`Цифра ${index + 1} кода`}
                                />
                            ))}
                        </div>
                        {emailVerification.status === 'error' && (
                            <p className="text-center text-sm text-red-600">{error || 'Неверный код'}</p>
                        )}
                        <div className="flex items-center justify-between gap-2">
                            <button type="button" onClick={() => setCurrentStep(1)} className="font-medium text-gray-600 transition-colors hover:text-gray-800">
                                Назад
                            </button>
                            <button
                                type="button"
                                onClick={() => dispatch(sendVerificationCode(formData.email))}
                                disabled={loading}
                                className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-800"
                            >
                                Отправить снова
                            </button>
                            <button
                                type="button"
                                onClick={handleVerifyCode}
                                disabled={loading || code.length !== 6}
                                className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
                            >
                                Продолжить
                            </button>
                        </div>
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="space-y-4">
                        <input
                            placeholder="Название организации"
                            value={formData.name_organization}
                            onChange={(e) => handleFieldChange('name_organization', e.target.value)}
                            className={inputClass}
                            required
                        />
                        <textarea
                            placeholder="Описание организации"
                            value={formData.description_organization}
                            onChange={(e) => handleFieldChange('description_organization', e.target.value)}
                            rows={3}
                            className={`${inputClass} resize-none`}
                            required
                        />
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
                                        setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
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
                                className={inputClass}
                                required
                            />
                            {suggestions.length > 0 && (
                                <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                                    {suggestions.map((s, i) => (
                                        <li
                                            key={i}
                                            onClick={() => selectAddress(s)}
                                            onMouseEnter={() => setHighlightedIndex(i)}
                                            className={`cursor-pointer px-4 py-2 ${i === highlightedIndex ? 'bg-indigo-100 text-indigo-800' : 'hover:bg-gray-100'}`}
                                        >
                                            {s.value}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        {addressError && <p className="text-sm text-red-600">{addressError}</p>}

                        <RegistrationLegalConsent
                            accepted={acceptedLegalConsent}
                            onChange={setAcceptedLegalConsent}
                            showError={showLegalErrors}
                        />

                        <div className="flex justify-between pt-1">
                            <button type="button" onClick={() => setCurrentStep(2)} className="font-medium text-gray-600 transition-colors hover:text-gray-800">
                                Назад
                            </button>
                            <button
                                type="button"
                                onClick={handleFinalSubmit}
                                disabled={loading || emailVerification.status !== 'verified' || !acceptedLegalConsent}
                                className="rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
                            >
                                {loading ? 'Отправка заявки...' : 'Отправить заявку'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {showSuccessModal && (
                <SuccessNotification
                    message="Проверьте email — там подтверждение заявки на регистрацию продавца. После одобрения администратором придёт письмо с паролем для входа."
                    onClose={() => setShowSuccessModal(false)}
                    onConfirm={() => {
                        setShowSuccessModal(false);
                        dispatch(resetRegistration());
                        dispatch(setIsBuyer(false));
                        setCurrentStep(1);
                        setAcceptedLegalConsent(false);
                        setAddressInput('');
                    }}
                />
            )}
        </div>
    );
}
