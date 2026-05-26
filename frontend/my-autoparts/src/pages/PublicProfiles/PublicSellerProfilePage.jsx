import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { apiAxiosUnauth, normalizeImageUrl } from '../../utils/apiClient';
import PageAmbientBackground from '../../components/PageAmbientBackground/PageAmbientBackground';
import UserAvatar from '../../components/UserAvatar/UserAvatar';

function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-40 rounded-3xl bg-slate-200" />
      <div className="h-24 rounded-2xl bg-slate-100" />
    </div>
  );
}

export default function PublicSellerProfilePage() {
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
        const res = await apiAxiosUnauth.get(`/public/sellers/${encodeURIComponent(publicCode)}`);
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
    const title = `${profile.display_name} — продавец на Свой Гараж`;
    const description = profile.organization_name
      ? `Продавец ${profile.display_name}, ${profile.organization_name}. Б/у запчасти на Свой Гараж.`
      : `Профиль продавца ${profile.display_name} на Свой Гараж.`;
    return { title, description };
  }, [profile]);

  if (loading) {
    return (
      <div className="relative mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <ProfileSkeleton />
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
        <p className="mt-2 text-sm text-gray-500">{error || 'Проверьте ссылку или ID пользователя.'}</p>
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
          <link rel="canonical" href={`${window.location.origin}/seller/${profile.public_code}`} />
        </Helmet>

        <div className="overflow-hidden rounded-3xl border border-white/80 bg-white/90 shadow-lg backdrop-blur">
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 px-6 py-8 text-white sm:px-8">
            <div className="flex flex-wrap items-center gap-4">
              <UserAvatar
                avatarUrl={profile.avatar_url}
                firstName={profile.display_name}
                size="xl"
                className="ring-4 ring-white/30"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-indigo-200">Продавец</p>
                <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{profile.display_name}</h1>
                <p className="mt-1 font-mono text-sm text-indigo-100">ID {profile.public_code}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 px-6 py-6 sm:px-8">
            {profile.organization_name && profile.organization_id ? (
              <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Организация</p>
                <Link
                  to={`/organizations/${profile.organization_id}`}
                  className="mt-1 inline-flex items-center gap-2 text-lg font-semibold text-indigo-700 hover:underline"
                >
                  {profile.organization_logo ? (
                    <img
                      src={normalizeImageUrl(profile.organization_logo)}
                      alt=""
                      className="h-8 w-8 rounded-lg object-cover"
                    />
                  ) : null}
                  {profile.organization_name}
                </Link>
              </div>
            ) : null}

            <div className="rounded-2xl border border-gray-100 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">В каталоге</p>
              <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">
                {profile.catalog_products_count}
                <span className="ml-2 text-base font-normal text-gray-500">позиций в наличии</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                to="/autoparts/used"
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                Смотреть б/у запчасти
              </Link>
              {profile.organization_id ? (
                <Link
                  to={`/organizations/${profile.organization_id}`}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  Страница организации
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
