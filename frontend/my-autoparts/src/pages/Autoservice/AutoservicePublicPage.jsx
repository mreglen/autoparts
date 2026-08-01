import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import PageAmbientBackground from '../../components/PageAmbientBackground/PageAmbientBackground';
import RegistrationLegalConsent from '../../components/Legal/RegistrationLegalConsent';
import {
  AUTOSERVICE_PUBLIC_ADDRESS,
  AUTOSERVICE_PUBLIC_CITY,
  AUTOSERVICE_PUBLIC_NAME,
  AUTOSERVICE_PUBLIC_TAGLINE,
} from '../../utils/autoserviceConstants';
import { BECOME_CLIENT_CONFIRM } from '../../utils/autoservicePublic';
import { apiAxios, apiAxiosUnauth, apiRequest } from '../../utils/apiClient';
import { formatPhoneInput, validatePhone } from '../../utils/contactValidation';
import { buildAutoserviceSeo, PageSeoHelmet } from '../../utils/pageSeo';

const inputClass =
  'mt-1.5 block w-full rounded-xl border border-gray-200 bg-gray-50/80 px-3.5 py-3 text-base text-gray-900 shadow-inner transition placeholder:text-gray-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/25 disabled:opacity-60';

const services = [
  {
    title: 'Техосмотр',
    text: 'Онлайн-заявка на удобную дату — подтвердим время по телефону.',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    title: 'Запись на ремонт',
    text: 'Клиенты сервиса видят свои записи и статусы в личном кабинете.',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    title: 'Гараж авто',
    text: 'Сохраняйте машины по VIN, марке и модели — история всегда под рукой.',
    icon: 'M8 17h.01M16 17h.01M3 13l2-5a2 2 0 011.85-1.25h10.3A2 2 0 0119 8l2 5m-18 0h18v4a1 1 0 01-1 1h-1a1 1 0 01-1-1v-1H6v1a1 1 0 01-1 1H4a1 1 0 01-1-1v-4z',
  },
  {
    title: 'Запчасти рядом',
    text: 'Каталог новых и б/у деталей платформы «Свой Гараж» — в одном месте.',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  },
];

const steps = [
  {
    step: '01',
    title: 'Оставьте заявку',
    text: 'Имя, телефон и желаемая дата — меньше минуты.',
  },
  {
    step: '02',
    title: 'Мы перезвоним',
    text: 'Подтвердим время и ответим на вопросы.',
  },
  {
    step: '03',
    title: 'Приезжайте',
    text: `${AUTOSERVICE_PUBLIC_ADDRESS}, ${AUTOSERVICE_PUBLIC_CITY}.`,
  },
];

function todayIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function scrollToBooking(e) {
  e?.preventDefault();
  document.getElementById('autoservice-booking')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

export default function AutoservicePublicPage() {
  const { token, user } = useSelector((state) => state.auth);
  const seo = useMemo(() => buildAutoserviceSeo(), []);
  const minDate = useMemo(() => todayIsoDate(), []);

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
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (!user || prefilled) return;
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
    if (fullName) setName(fullName);
    if (user.phone) setPhone(formatPhoneInput(String(user.phone)));
    setPrefilled(true);
  }, [user, prefilled]);

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
    <div className="relative w-full text-gray-900">
      <PageSeoHelmet seo={seo} />
      <PageAmbientBackground />

      {/* Business-card hero */}
      <section className="relative overflow-hidden pt-10 pb-14 sm:pt-14 sm:pb-18 md:pt-16 md:pb-20">
        <div className="pointer-events-none absolute -right-16 top-8 h-80 w-80 rounded-full bg-gradient-to-br from-blue-400/30 to-indigo-500/20 blur-3xl sm:h-[28rem] sm:w-[28rem]" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-64 w-64 rounded-full bg-gradient-to-tr from-sky-400/20 to-transparent blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-12 xl:gap-14">
            <div className="space-y-8 lg:col-span-6 lg:pt-2">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-100/80 bg-white/90 px-4 py-2 text-sm font-medium text-blue-800 shadow-sm shadow-blue-500/5 backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Принимаем заявки · {AUTOSERVICE_PUBLIC_CITY}
                </div>

                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-600">
                    Автосервис
                  </p>
                  <h1 className="mt-2 text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-gray-900 sm:text-5xl lg:text-[3.35rem] lg:leading-[1.05]">
                    {AUTOSERVICE_PUBLIC_NAME.split(' на ')[0]}
                    <span className="mt-1 block bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 bg-clip-text text-transparent">
                      на {AUTOSERVICE_PUBLIC_ADDRESS}
                    </span>
                  </h1>
                </div>

                <p className="max-w-xl text-pretty text-lg leading-relaxed text-gray-600 sm:text-xl">
                  {AUTOSERVICE_PUBLIC_TAGLINE}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <a
                  href="#autoservice-booking"
                  onClick={scrollToBooking}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-3 text-center text-base font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl active:scale-[0.98]"
                >
                  Записаться на ТО
                </a>
                {token ? (
                  <Link
                    to="/garage"
                    className="inline-flex min-h-12 items-center justify-center rounded-xl border border-indigo-200 bg-white px-8 py-3 text-center text-base font-semibold text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-md"
                  >
                    Мой гараж
                  </Link>
                ) : (
                  <Link
                    to="/auth"
                    className="inline-flex min-h-12 items-center justify-center rounded-xl border border-gray-300/90 bg-white px-8 py-3 text-center text-base font-semibold text-gray-800 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-900 hover:shadow-md"
                  >
                    Войти в кабинет
                  </Link>
                )}
              </div>

              <div className="grid gap-3 rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm ring-1 ring-gray-200/60 backdrop-blur-sm sm:grid-cols-2 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Адрес</p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900">
                      {AUTOSERVICE_PUBLIC_ADDRESS}
                    </p>
                    <p className="text-sm text-gray-600">{AUTOSERVICE_PUBLIC_CITY}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Запись</p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900">Онлайн-заявка</p>
                    <p className="text-sm text-gray-600">Подтверждение по телефону</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Booking card — primary CTA */}
            <div className="lg:col-span-6" id="autoservice-booking">
              <div className="relative mx-auto max-w-lg lg:ml-auto lg:max-w-none">
                <div className="absolute -inset-1 rounded-[1.45rem] bg-gradient-to-br from-blue-500 via-indigo-500 to-sky-500 opacity-[0.22] blur-sm" />
                <div className="relative rounded-2xl border border-white/70 bg-white/95 p-5 shadow-2xl shadow-indigo-950/12 ring-1 ring-gray-200/60 backdrop-blur-md sm:p-7">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
                        Заявка на техосмотр
                      </h2>
                      <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
                        Оставьте контакты — перезвоним и подтвердим визит.
                      </p>
                    </div>
                    <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-600/30 sm:flex">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>

                  {submitted ? (
                    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white px-5 py-8 text-center">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-600/30">
                        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-lg font-semibold text-emerald-900">Заявка принята</p>
                      <p className="mt-2 text-sm leading-relaxed text-emerald-800/90">
                        Свяжемся по телефону и подтвердим удобное время.
                      </p>
                      <button
                        type="button"
                        onClick={() => setSubmitted(false)}
                        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-200 bg-white px-5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
                      >
                        Отправить ещё одну
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
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
                          placeholder="Как к вам обращаться"
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
                          className={`${inputClass} ${phoneError ? 'border-red-400 focus:border-red-400 focus:ring-red-500/20' : ''}`}
                          value={phone}
                          onChange={(e) => {
                            setPhone(formatPhoneInput(e.target.value));
                            setPhoneError('');
                          }}
                          placeholder="+7 (___) ___-__-__"
                          disabled={saving}
                          required
                        />
                        {phoneError && <p className="mt-1.5 text-sm text-red-600">{phoneError}</p>}
                      </div>

                      <div>
                        <label htmlFor="autoservice-date" className="block text-sm font-medium text-gray-700">
                          Желаемая дата
                        </label>
                        <input
                          id="autoservice-date"
                          type="date"
                          min={minDate}
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
                        <p
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                          role="alert"
                        >
                          {error}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:from-blue-700 hover:to-indigo-700 hover:shadow-indigo-600/35 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:active:scale-100"
                      >
                        {saving ? (
                          <span className="flex items-center gap-2">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                            Отправка…
                          </span>
                        ) : (
                          'Отправить заявку'
                        )}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="relative border-t border-indigo-100/60 bg-white/55 py-14 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">Что мы предлагаем</h2>
            <p className="mt-2 text-base text-gray-600">
              Сервис и кабинет клиента — в одной экосистеме «Свой Гараж».
            </p>
          </div>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((item) => (
              <li
                key={item.title}
                className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm ring-1 ring-gray-100 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
              >
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-600/25">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={item.icon} />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{item.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section className="relative py-14 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">Как записаться</h2>
            <p className="mt-2 text-base text-gray-600">Три шага от заявки до визита.</p>
          </div>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-5">
            {steps.map((item) => (
              <li
                key={item.step}
                className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm ring-1 ring-gray-100 sm:p-6"
              >
                <span className="text-3xl font-extrabold tracking-tight text-indigo-100">{item.step}</span>
                <h3 className="mt-3 text-lg font-bold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Client CTA */}
      <section className="relative pb-14 sm:pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 px-6 py-10 shadow-xl shadow-indigo-900/25 sm:px-10 sm:py-12">
            <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-7">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-200">
                  Для клиентов
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-white drop-shadow-sm md:text-3xl">
                  Личный гараж и история записей
                </h2>
                <p className="mt-3 max-w-xl text-base leading-relaxed text-indigo-100">
                  Станьте клиентом {AUTOSERVICE_PUBLIC_NAME}: сохраняйте автомобили и следите за записями на
                  обслуживание в кабинете.
                </p>
              </div>
              <div className="lg:col-span-5">
                <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm sm:p-6">
                  {!token || !user ? (
                    <div className="space-y-3">
                      <p className="text-sm text-indigo-100">
                        Войдите в аккаунт, чтобы стать клиентом автосервиса.
                      </p>
                      <Link
                        to="/auth"
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-indigo-700 shadow-lg transition hover:bg-indigo-50"
                      >
                        Войти или зарегистрироваться
                      </Link>
                    </div>
                  ) : meLoading ? (
                    <p className="text-sm text-indigo-100">Проверяем статус клиента…</p>
                  ) : isClient ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-white">
                        Вы клиент автосервиса{becomeSuccess ? '. Добро пожаловать!' : '.'}
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Link
                          to="/garage"
                          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-indigo-700 shadow-lg transition hover:bg-indigo-50"
                        >
                          Открыть гараж
                        </Link>
                        <Link
                          to="/garage/orders"
                          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-white/40 bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/20"
                        >
                          Мои записи
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-indigo-100">
                        Подтвердите согласие — откроются гараж и раздел записей.
                      </p>
                      <button
                        type="button"
                        onClick={handleBecomeClient}
                        disabled={becomeSaving}
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-indigo-700 shadow-lg transition hover:bg-indigo-50 disabled:opacity-60"
                      >
                        {becomeSaving ? 'Сохранение…' : 'Стать клиентом автосервиса'}
                      </button>
                      {becomeError && (
                        <p className="text-sm text-red-200" role="alert">
                          {becomeError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact strip / visiting card footer */}
      <section className="border-t border-indigo-100/70 bg-white/80 py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">Контакты</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{AUTOSERVICE_PUBLIC_NAME}</p>
            <p className="mt-0.5 text-sm text-gray-600">
              {AUTOSERVICE_PUBLIC_ADDRESS}, {AUTOSERVICE_PUBLIC_CITY}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              to="/autoparts/new"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-800 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-indigo-900"
            >
              Каталог запчастей
            </Link>
            <a
              href="#autoservice-booking"
              onClick={scrollToBooking}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50/90 px-6 text-sm font-semibold text-indigo-800 transition hover:bg-indigo-100"
            >
              Записаться на техосмотр
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
