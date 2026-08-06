import React from 'react';
import { Link } from 'react-router-dom';
import UserAvatar from '../UserAvatar/UserAvatar';
import { normalizeImageUrl } from '../../utils/apiClient';
import { formatOrganizationPhone } from '../../pages/Organizations/organizationPublicUtils';
import { Badge, Button } from '../UI';

function roleLabels(profile) {
  const parts = [];
  if (profile.is_seller) parts.push('Продавец');
  if (profile.is_buyer) parts.push('Покупатель');
  return parts.length ? parts.join(' · ') : 'Участник';
}

export default function ProfileHeader({
  profile,
  orgDetail,
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
    <div className="border-b border-line bg-surface-muted px-6 py-10 sm:px-10 sm:py-12">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
          <UserAvatar
            avatarUrl={profile.avatar_url}
            firstName={profile.display_name}
            size="xl"
            className="ring-2 ring-line shadow-sg"
          />
          <div className="min-w-0 flex-1">
            <Badge tone={profile.is_seller ? 'brand' : 'neutral'}>
              {roleLabels(profile)}
            </Badge>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{profile.display_name}</h1>

            {profile.is_seller && profile.organization_name && profile.organization_id ? (
              <Link
                to={`/organizations/${profile.organization_id}`}
                className="mt-2 inline-flex items-center gap-2 text-base font-medium text-brand-600 hover:underline"
              >
                {profile.organization_logo ? (
                  <img
                    src={normalizeImageUrl(profile.organization_logo)}
                    alt=""
                    className="h-6 w-6 rounded-sg object-cover ring-1 ring-line"
                  />
                ) : null}
                {profile.organization_name}
              </Link>
            ) : null}

            {profile.is_seller && address ? (
              <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-muted sm:text-base">
                <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{address}</span>
              </p>
            ) : null}

            {profile.is_seller && phone ? (
              <p className="mt-1 text-sm text-ink-muted">{phone}</p>
            ) : null}

            <p className="mt-2 font-mono text-xs text-ink-faint">ID {profile.public_code}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col lg:items-stretch">
          {showMessageButton ? (
            <Button
              type="button"
              onClick={onWriteMessage}
              disabled={startingChat}
              loading={startingChat}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {startingChat ? 'Открываем…' : 'Написать'}
            </Button>
          ) : null}
          {profile.is_seller ? (
            <Button as={Link} to={catalogHref} variant="secondary">
              Каталог
            </Button>
          ) : null}
          {isOwnProfile ? (
            <Button as={Link} to="/profile" variant="secondary">
              Мой профиль
            </Button>
          ) : !token && profile.is_seller ? (
            <Button as={Link} to="/auth" state={{ from: `/users/${publicCode}` }} variant="secondary">
              Войти, чтобы написать
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
