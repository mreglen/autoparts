import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { apiAxiosUnauth } from '../../utils/apiClient';
import PageAmbientBackground from '../../components/PageAmbientBackground/PageAmbientBackground';
import UserAvatar from '../../components/UserAvatar/UserAvatar';

export default function PublicBuyerProfilePage() {
  const { publicCode } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await apiAxiosUnauth.get(`/public/buyers/${encodeURIComponent(publicCode)}`);
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
      title: `${profile.display_name} — покупатель на Свой Гараж`,
      description: `Публичный профиль покупателя ${profile.display_name} (ID ${profile.public_code}) на Свой Гараж.`,
    };
  }, [profile]);

  if (loading) {
    return (
      <div className="relative mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="h-48 animate-pulse rounded-3xl bg-slate-200" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Helmet>
          <title>Профиль не найден — Свой Гараж</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <h1 className="text-xl font-semibold text-gray-900">Профиль не найден</h1>
        <p className="mt-2 text-sm text-gray-500">{error}</p>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:underline">
          На главную
        </Link>
      </div>
    );
  }

  return (
    <div className="relative min-h-[60vh]">
      <PageAmbientBackground />
      <div className="relative mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Helmet>
          <title>{seo.title}</title>
          <meta name="description" content={seo.description} />
          <link rel="canonical" href={`${window.location.origin}/buyer/${profile.public_code}`} />
        </Helmet>

        <div className="overflow-hidden rounded-3xl border border-white/80 bg-white/90 shadow-lg backdrop-blur">
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 px-6 py-8 text-white sm:px-8">
            <div className="flex flex-wrap items-center gap-4">
              <UserAvatar
                avatarUrl={profile.avatar_url}
                firstName={profile.display_name}
                size="xl"
                className="ring-4 ring-white/30"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-100">Покупатель</p>
                <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{profile.display_name}</h1>
                <p className="mt-1 font-mono text-sm text-emerald-50">ID {profile.public_code}</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-6 sm:px-8">
            <p className="text-sm text-gray-600">
              Публичная страница участника маркетплейса. Контактные данные доступны только в переписке на сайте.
            </p>
            {profile.is_seller ? (
              <p className="mt-3 text-sm text-gray-500">
                Также зарегистрирован как продавец —{' '}
                <Link to={`/seller/${profile.public_code}`} className="font-medium text-indigo-600 hover:underline">
                  открыть профиль продавца
                </Link>
              </p>
            ) : null}
            <Link
              to="/autoparts/used"
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Каталог запчастей
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
