import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import PageAmbientBackground from '../../components/PageAmbientBackground/PageAmbientBackground';
import RegistrationLegalConsent from '../../components/Legal/RegistrationLegalConsent';
import { AUTOSERVICE_PUBLIC_NAME } from '../../utils/autoserviceConstants';
import { BECOME_CLIENT_CONFIRM } from '../../utils/autoservicePublic';
import { apiAxios, apiAxiosUnauth, apiRequest } from '../../utils/apiClient';
import { formatPhoneInput, validatePhone } from '../../utils/contactValidation';

const inputClass =
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

export default function AutoservicePublicPage() {
  const { token, user } = useSelector((state) => state.auth);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [showConsentError, setShowConsentError] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [meLoading, setMeLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [becomeSaving, setBecomeSaving] = useState(false);
  const [becomeError, setBecomeError] = useState(null);
  const [becomeSuccess, setBecomeSuccess] = useState(false);

  const loadMe = useCallback(async () => {
    if (!token || !user) {
      setIsClient(false);
      return;
    }
    setMeLoading(true);
    setBecomeError(null);
    try {
      const data = await apiRequest('/autoservice/clients/me');
      setIsClient(data?.is_client === true);
    } catch {
      setIsClient(false);
    } finally {
      setMeLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const handleBecomeClient = async () => {
    setBecomeError(null);
    if (!window.confirm(BECOME_CLIENT_CONFIRM(AUTOSERVICE_PUBLIC_NAME))) {
      return;
    }
    setBecomeSaving(true);
    try {
      await apiRequest('/autoservice/clients/me', { method: 'POST' });
      setIsClient(true);
      setBecomeSuccess(true);
    } catch (err) {
      setBecomeError(err?.message || 'Не удалось стать клиентом');
    } finally {
      setBecomeSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setPhoneError('');
    setShowConsentError(false);

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError('Укажите имя');
      return;
    }
    const phoneErr = validatePhone(phone);
    if (phoneErr) {
      setPhoneError(phoneErr);
      return;
    }
    if (!preferredDate) {
      setError('Укажите желаемую дату');
      return;
    }
    if (!consentAccepted) {
      setShowConsentError(true);
      return;
    }

    setSaving(true);
    try {
      const client = token ? apiAxios : apiAxiosUnauth;
      await client.post('/public/autoservice/inspection-bookings', {
        name: trimmedName,
        phone,
        preferred_date: preferredDate,
      });
      setSubmitted(true);
      setName('');
      setPhone('');
      setPreferredDate('');
      setConsentAccepted(false);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Не удалось отправить заявку');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-[60vh]">
      <PageAmbientBackground />
      <div className="relative mx-auto max-w-xl px-4 py-12 sm:py-16">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Автосервис</h1>
        <p className="mt-2 text-sm text-gray-500">{AUTOSERVICE_PUBLIC_NAME}</p>
        <p className="mt-4 text-base leading-relaxed text-gray-700">
          Оставьте заявку на техосмотр — мы свяжемся с вами для подтверждения.
        </p>

        {token && user && (
          <div className="mt-6 rounded-xl border border-gray-200 bg-white/80 px-4 py-4">
            {meLoading ? (
              <p className="text-sm text-gray-500">Проверяем статус клиента…</p>
            ) : isClient ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-emerald-800">
                  Вы клиент автосервиса{becomeSuccess ? '. Спасибо!' : '.'}
                </p>
                <Link
                  to="/garage"
                  className="inline-flex text-sm font-semibold text-indigo-700 hover:underline"
                >
                  Мой гараж
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Станьте клиентом автосервиса, чтобы в дальнейшем пользоваться гаражом и записями.
                </p>
                <button
                  type="button"
                  onClick={handleBecomeClient}
                  disabled={becomeSaving}
                  className="w-full rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-60"
                >
                  {becomeSaving ? 'Сохранение…' : 'Стать клиентом автосервиса'}
                </button>
                {becomeError && (
                  <p className="text-sm text-red-600" role="alert">
                    {becomeError}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {submitted && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Заявка отправлена. Мы свяжемся с вами по указанному телефону.
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="autoservice-name" className="block text-sm font-medium text-gray-700">
              Имя
            </label>
            <input
              id="autoservice-name"
              type="text"
              autoComplete="name"
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              maxLength={120}
              required
            />
          </div>

          <div>
            <label htmlFor="autoservice-phone" className="block text-sm font-medium text-gray-700">
              Телефон
            </label>
            <input
              id="autoservice-phone"
              type="tel"
              autoComplete="tel"
              className={`${inputClass} ${phoneError ? 'border-red-500' : ''}`}
              value={phone}
              onChange={(e) => {
                setPhone(formatPhoneInput(e.target.value));
                setPhoneError('');
              }}
              placeholder="+7 (___) ___-__-__"
              disabled={saving}
              required
            />
            {phoneError && <p className="mt-1 text-sm text-red-600">{phoneError}</p>}
          </div>

          <div>
            <label htmlFor="autoservice-date" className="block text-sm font-medium text-gray-700">
              Желаемая дата
            </label>
            <input
              id="autoservice-date"
              type="date"
              className={inputClass}
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              disabled={saving}
              required
            />
          </div>

          <RegistrationLegalConsent
            accepted={consentAccepted}
            onChange={(v) => {
              setConsentAccepted(v);
              if (v) setShowConsentError(false);
            }}
            showError={showConsentError}
          />

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Отправка…' : 'Отправить заявку'}
          </button>
        </form>
      </div>
    </div>
  );
}
