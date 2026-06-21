import React from 'react';
import { Link } from 'react-router-dom';
import UserAvatar from '../UserAvatar/UserAvatar';
import { normalizeImageUrl } from '../../utils/apiClient';
import { formatOrganizationPhone } from '../../pages/Organizations/organizationPublicUtils';

function roleLabels(profile) {
  const parts = [];
  if (profile.is_seller) parts.push('Продавец');
  if (profile.is_buyer) parts.push('Покупатель');
  return parts.length ? parts.join(' · ') : 'Участник';
}

export default function ProfileHeader({
  profile,
  orgDetail,
  accent,
  showMessageButton,
  isOwnProfile,
  token,
  startingChat,
  onWriteMessage,
  publicCode,
}) {
  const phone = formatOrganizationPhone(orgDetail?.phone);
  const address = (orgDetail?.address || '').trim();
  const catalogHref = profile.organization_id
    ? `/autoparts/used?organization_id=${encodeURIComponent(profile.organization_id)}`
    : '/autoparts/used';

  return (
    <div className={`relative bg-gradient-to-br ${accent} px-6 py-10 sm:px-10 sm:py-12`}>
      <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-6 h-32 w-32 rounded-full bg-black/10 blur-2xl" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
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

            {profile.is_seller && profile.organization_name && profile.organization_id ? (
              <Link
                to={`/organizations/${profile.organization_id}`}
                className="mt-2 inline-flex items-center gap-2 text-base font-medium text-white/95 hover:underline"
              >
                {profile.organization_logo ? (
                  <img
                    src={normalizeImageUrl(profile.organization_logo)}
                    alt=""
                    className="h-6 w-6 rounded-md object-cover ring-1 ring-white/30"
                  />
                ) : null}
                {profile.organization_name}
              </Link>
            ) : null}

            {profile.is_seller && address ? (
              <p className="mt-2 flex items-start gap-1.5 text-sm text-white/85 sm:text-base">
                <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{address}</span>
              </p>
            ) : null}

            {profile.is_seller && phone ? (
              <p className="mt-1 text-sm text-white/80">{phone}</p>
            ) : null}

            <p className="mt-2 font-mono text-xs text-white/70">ID {profile.public_code}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col lg:items-stretch">
          {showMessageButton ? (
            <button
              type="button"
              onClick={onWriteMessage}
              disabled={startingChat}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-indigo-700 shadow-md transition hover:bg-indigo-50 disabled:opacity-60"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {startingChat ? 'Открываем…' : 'Написать'}
            </button>
          ) : null}
          {profile.is_seller ? (
            <Link
              to={catalogHref}
              className="inline-flex items-center justify-center rounded-xl border border-white/40 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20"
            >
              Каталог
            </Link>
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
              state={{ from: `/users/${publicCode}` }}
              className="inline-flex items-center justify-center rounded-xl border border-white/40 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20"
            >
              Войти, чтобы написать
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
