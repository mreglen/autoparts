import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  completeRegistration,
  fetchProfile,
  login as loginThunk,
  resetRegistration,
  sendVerificationCode,
  setIsBuyer,
  updateCode,
  verifyEmailCode,
} from '../../redux/slices/AuthSlice';
import { fetchCart } from '../../redux/slices/CartSlice';
import RegistrationLegalConsent from '../Legal/RegistrationLegalConsent';
import Modal from '../UI/Modal';

const inputClass =
  'w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm max-md:text-base min-h-11 text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

const tabBase =
  'flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition min-h-11';

function formatPhoneInputValue(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.startsWith('9')) digits = `7${digits}`;
  if (!digits.startsWith('7')) digits = digits ? `7${digits}` : '';
  digits = digits.slice(0, 11);

  if (!digits) return '';
  const body = digits.slice(1);
  if (body.length <= 3) return `+7 (${body}`;
  if (body.length <= 6) return `+7 (${body.slice(0, 3)}) ${body.slice(3)}`;
  if (body.length <= 8) return `+7 (${body.slice(0, 3)}) ${body.slice(3, 6)}-${body.slice(6)}`;
  return `+7 (${body.slice(0, 3)}) ${body.slice(3, 6)}-${body.slice(6, 8)}-${body.slice(8)}`;
}

function validatePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return 'Укажите телефон';
  if (digits.length !== 11 || !digits.startsWith('7')) return 'Неверный формат телефона';
  return '';
}

function validateEmail(value) {
  const email = String(value || '').trim();
  if (!email) return 'Укажите email';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Неверный формат email';
  return '';
}

export default function CartAuthModal({ isOpen, onClose, onAuthSuccess }) {
  const dispatch = useDispatch();
  const auth = useSelector((state) => state.auth);
  const { loading, error, code, emailVerification } = auth;

  const [tab, setTab] = useState('login');
  const [registerStep, setRegisterStep] = useState('form');
  const [loginForm, setLoginForm] = useState({ login: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    password_repeat: '',
  });
  const [acceptedConsent, setAcceptedConsent] = useState(false);
  const [showConsentError, setShowConsentError] = useState(false);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setTab('login');
      setRegisterStep('form');
      setLoginForm({ login: '', password: '' });
      setRegisterForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        password: '',
        password_repeat: '',
      });
      setAcceptedConsent(false);
      setShowConsentError(false);
      setLocalError('');
      dispatch(resetRegistration());
      return;
    }
    dispatch(setIsBuyer(true));
  }, [dispatch, isOpen]);

  const visibleError = localError || error || '';

  const registerFieldErrors = useMemo(() => ({
    first_name: registerForm.first_name.trim() ? '' : 'Укажите имя',
    email: validateEmail(registerForm.email),
    phone: validatePhone(registerForm.phone),
    password: registerForm.password ? '' : 'Введите пароль',
    password_repeat: registerForm.password_repeat ? '' : 'Повторите пароль',
  }), [registerForm]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    try {
      await dispatch(loginThunk({ login: loginForm.login.trim(), password: loginForm.password })).unwrap();
      await dispatch(fetchProfile()).unwrap().catch(() => {});
      await dispatch(fetchCart());
      onAuthSuccess?.();
    } catch (_) {
      /* error comes from store */
    }
  };

  const handleSendCode = async (e) => {
    e.preventDefault();
    setLocalError('');
    if (registerFieldErrors.first_name || registerFieldErrors.email || registerFieldErrors.phone) {
      setLocalError(
        registerFieldErrors.first_name || registerFieldErrors.email || registerFieldErrors.phone
      );
      return;
    }
    if (!registerForm.password || !registerForm.password_repeat) {
      setLocalError('Введите пароль и подтверждение');
      return;
    }
    if (registerForm.password !== registerForm.password_repeat) {
      setLocalError('Пароли не совпадают');
      return;
    }
    if (!acceptedConsent) {
      setShowConsentError(true);
      setLocalError('Подтвердите согласие на обработку данных');
      return;
    }
    setShowConsentError(false);
    try {
      await dispatch(sendVerificationCode(registerForm.email.trim())).unwrap();
      setRegisterStep('verify');
    } catch (_) {
      /* error comes from store */
    }
  };

  const handleVerifyAndComplete = useCallback(async (e) => {
    e?.preventDefault?.();
    setLocalError('');
    if (String(code || '').length !== 6) {
      setLocalError('Введите 6 цифр кода');
      return;
    }
    try {
      await dispatch(verifyEmailCode({ email: registerForm.email.trim(), code })).unwrap();
      await dispatch(completeRegistration({
        first_name: registerForm.first_name.trim(),
        last_name: registerForm.last_name.trim(),
        patronymic: '',
        email: registerForm.email.trim(),
        phone: registerForm.phone,
        password: registerForm.password,
        is_buyer: true,
        is_seller: false,
      })).unwrap();
      await dispatch(fetchProfile()).unwrap().catch(() => {});
      await dispatch(fetchCart());
      onAuthSuccess?.();
    } catch (_) {
      /* error comes from store */
    }
  }, [code, dispatch, onAuthSuccess, registerForm]);

  const modalTitle = (
    <div>
      <h2 className="text-xl font-bold text-gray-900">Оформить заказ</h2>
      <p className="mt-1 text-sm font-normal text-gray-500">
        Войдите или зарегистрируйтесь
      </p>
    </div>
  );

  return (
    <Modal open={isOpen} onClose={onClose} title={modalTitle} size="sm">
      <div className="mb-5 flex gap-2 rounded-2xl bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => {
            setTab('login');
            setLocalError('');
          }}
          className={`${tabBase} ${tab === 'login' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-600'}`}
        >
          Вход
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('register');
            setLocalError('');
            dispatch(setIsBuyer(true));
          }}
          className={`${tabBase} ${tab === 'register' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-600'}`}
        >
          Регистрация
        </button>
      </div>

      {visibleError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {visibleError}
        </div>
      ) : null}

      {tab === 'login' ? (
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <input
            type="text"
            value={loginForm.login}
            onChange={(e) => setLoginForm((prev) => ({ ...prev, login: e.target.value }))}
            placeholder="Email или телефон"
            className={inputClass}
            autoComplete="username"
            required
          />
          <input
            type="password"
            value={loginForm.password}
            onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
            placeholder="Пароль"
            className={inputClass}
            autoComplete="current-password"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="min-h-11 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? 'Вход…' : 'Войти'}
          </button>
        </form>
      ) : registerStep === 'form' ? (
        <form onSubmit={handleSendCode} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={registerForm.first_name}
              onChange={(e) => setRegisterForm((prev) => ({ ...prev, first_name: e.target.value }))}
              placeholder="Имя"
              className={inputClass}
              required
            />
            <input
              type="text"
              value={registerForm.last_name}
              onChange={(e) => setRegisterForm((prev) => ({ ...prev, last_name: e.target.value }))}
              placeholder="Фамилия"
              className={inputClass}
            />
          </div>
          <input
            type="email"
            value={registerForm.email}
            onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="Email"
            className={inputClass}
            autoComplete="email"
            required
          />
          <input
            type="tel"
            value={registerForm.phone}
            onChange={(e) => setRegisterForm((prev) => ({ ...prev, phone: formatPhoneInputValue(e.target.value) }))}
            placeholder="+7 (___) ___-__-__"
            className={inputClass}
            autoComplete="tel"
            required
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="password"
              value={registerForm.password}
              onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="Пароль"
              className={inputClass}
              autoComplete="new-password"
              required
            />
            <input
              type="password"
              value={registerForm.password_repeat}
              onChange={(e) => setRegisterForm((prev) => ({ ...prev, password_repeat: e.target.value }))}
              placeholder="Повторите пароль"
              className={inputClass}
              autoComplete="new-password"
              required
            />
          </div>
          <RegistrationLegalConsent
            accepted={acceptedConsent}
            onChange={(value) => {
              setAcceptedConsent(value);
              if (value) setShowConsentError(false);
            }}
            showError={showConsentError}
          />
          <button
            type="submit"
            disabled={loading}
            className="min-h-11 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? 'Отправка…' : 'Продолжить'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyAndComplete} className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            Код отправлен на <span className="font-medium text-gray-900">{registerForm.email}</span>
          </div>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
              dispatch(updateCode(digits));
            }}
            placeholder="Код из email"
            className={`${inputClass} text-center font-mono text-lg tracking-[0.25em]`}
            autoComplete="one-time-code"
            required
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setRegisterStep('form');
                setLocalError('');
                dispatch(updateCode(''));
              }}
              className="min-h-11 flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Назад
            </button>
            <button
              type="submit"
              disabled={loading || emailVerification.status === 'verified'}
              className="min-h-11 flex-1 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? 'Подтверждение…' : 'Зарегистрироваться'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
