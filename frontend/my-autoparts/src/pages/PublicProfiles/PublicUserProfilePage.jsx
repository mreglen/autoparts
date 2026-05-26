import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { apiAxiosUnauth, normalizeImageUrl } from '../../utils/apiClient';
import PageAmbientBackground from '../../components/PageAmbientBackground/PageAmbientBackground';
import UserAvatar from '../../components/UserAvatar/UserAvatar';
import { createOrGetChatWithUser } from '../../redux/slices/ChatSlice';

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse px-4 py-10 sm:px-6">
      <div className="h-56 rounded-3xl bg-slate-200" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="h-28 rounded-2xl bg-slate-100" />
        <div className="h-28 rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}

function roleLabels(profile) {
  const parts = [];
  if (profile.is_seller) parts.push('Продавец');
  if (profile.is_buyer) parts.push('Покупатель');
  return parts.length ? parts.join(' · ') : 'Участник';
}

function canStartDirectChat(profile, currentUser) {
  if (!profile?.user_id || !currentUser?.id) return false;
  if (profile.user_id === currentUser.id) return false;
  if (profile.is_seller) return true;
  if (currentUser.is_seller && profile.is_buyer) return true;
  if (currentUser.is_seller) return true;
  return false;
}

export default function PublicUserProfilePage() {
  const { publicCode } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, token } = useSelector((state) => state.auth);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startingChat, setStartingChat] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await apiAxiosUnauth.get(`/public/users/${encodeURIComponent(publicCode)}`);
        if (!cancelled) setProfile(res.data);
      } catch (e) {
        if (!cancelled) {
          setProfile(null);
          const detail = e?.response?.data?.detail;
          setError(typeof detail === 'string' ? detail : 'Профиль не найден');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicCode]);

  const seo = useMemo(() => {
    if (!profile) return null;
    return {
      title: `${profile.display_name} — ${roleLabels(profile)} на Свой Гараж`,
      description: `Публичный профиль ${profile.display_name} (ID ${profile.public_code}) на Свой Гараж.`,
    };
  }, [profile]);

  const showMessageButton = canStartDirectChat(profile, user);
  const isOwnProfile = profile?.user_id && user?.id && profile.user_id === user.id;

  const handleWriteMessage = async () => {
    if (!token) {
      navigate('/auth', { state: { from: `/users/${publicCode}` } });
      return;
    }
    if (!profile?.user_id || startingChat) return;

    setStartingChat(true);
    try {
      const chat = await dispatch(createOrGetChatWithUser(profile.user_id)).unwrap();
      navigate(`/chats?source=garage&chatId=${chat.id}`);
    } catch (e) {
      const msg = typeof e === 'string' ? e : 'Не удалось открыть чат';
      alert(msg);
    } finally {
      setStartingChat(false);
    }
  };

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <Helmet>
          <title>Профиль не найден — Свой Гараж</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-2xl text-gray-400">
          ?
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Профиль не найден</h1>
        <p className="mt-2 text-sm text-gray-500">{error || 'Проверьте ссылку или ID пользователя.'}</p>
        <Link to="/" className="mt-8 inline-flex rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
          На главную
        </Link>
      </div>
    );
  }

  const accent = profile.is_seller
    ? 'from-indigo-600 via-indigo-700 to-violet-800'
    : 'from-teal-600 via-emerald-600 to-cyan-700';

  return (
    <div className="relative min-h-[70vh] pb-16">
      <PageAmbientBackground />
      <div className="relative mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
        <Helmet>
          <title>{seo.title}</title>
          <meta name="description" content={seo.description} />
          <link rel="canonical" href={`${window.location.origin}/users/${profile.public_code}`} />
        </Helmet>

        <div className="overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-xl shadow-gray-200/50">
          <div className={`relative bg-gradient-to-br ${accent} px-6 py-10 sm:px-10 sm:py-12`}>
            <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-6 h-32 w-32 rounded-full bg-black/10 blur-2xl" />

            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end">
              <UserAvatar
                avatarUrl={profile.avatar_url}
                firstName={profile.display_name}
                size="xl"
                className="ring-4 ring-white/40 shadow-lg"
              />
              <div className="min-w-0 flex-1 text-white">
                <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide backdrop-blur-sm">
                  {roleLabels(profile)}
                </span>
                <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{profile.display_name}</h1>
                <p className="mt-2 font-mono text-sm text-white/85">ID {profile.public_code}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
                {showMessageButton ? (
                  <button
                    type="button"
                    onClick={handleWriteMessage}
                    disabled={startingChat}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-indigo-700 shadow-md transition hover:bg-indigo-50 disabled:opacity-60"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {startingChat ? 'Открываем…' : 'Написать'}
                  </button>
                ) : null}
                {isOwnProfile ? (
                  <Link
                    to="/profile"
                    className="inline-flex items-center justify-center rounded-xl border border-white/40 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20"
                  >
                    Мой профиль
                  </Link>
                ) : !token && profile.is_seller ? (
                  <Link
                    to="/auth"
                    className="inline-flex items-center justify-center rounded-xl border border-white/40 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20"
                  >
                    Войти, чтобы написать
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
            {profile.organization_name && profile.organization_id ? (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Организация</p>
                <Link
                  to={`/organizations/${profile.organization_id}`}
                  className="mt-2 inline-flex items-center gap-3 text-lg font-semibold text-indigo-700 hover:underline"
                >
                  {profile.organization_logo ? (
                    <img
                      src={normalizeImageUrl(profile.organization_logo)}
                      alt=""
                      className="h-10 w-10 rounded-xl object-cover ring-1 ring-gray-200"
                    />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-sm font-bold text-indigo-600">
                      {profile.organization_name.charAt(0)}
                    </span>
                  )}
                  {profile.organization_name}
                </Link>
              </div>
            ) : null}

            {profile.is_seller ? (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">В каталоге</p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-gray-900">
                  {profile.catalog_products_count}
                </p>
                <p className="text-sm text-gray-600">позиций в наличии</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">На платформе</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  Участник маркетплейса Свой Гараж. Связаться можно через встроенные сообщения.
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-gray-100 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Быстрые действия</p>
              <div className="mt-3 flex flex-col gap-2">
                <Link
                  to="/autoparts/used"
                  className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
                >
                  Каталог б/у
                </Link>
                {profile.organization_id ? (
                  <Link
                    to={`/organizations/${profile.organization_id}`}
                    className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    Страница организации
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
