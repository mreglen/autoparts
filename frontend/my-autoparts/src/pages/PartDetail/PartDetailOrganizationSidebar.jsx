import React from 'react';
import { Link } from 'react-router-dom';
import { Button, Card } from '../../components/UI';
import { resolveProductCity } from '../../utils/productSearchSeo';

export default function PartDetailOrganizationSidebar({
  organization,
  logoUrl = null,
  showSellerContact = false,
  onPhoneClick,
  onWriteClick,
  creatingChat = false,
}) {
  if (!organization?.id && !organization?.name) return null;

  const sellerName = (organization?.name || '').trim();
  const contactPerson = (organization?.contact_person || '').trim();
  const city = resolveProductCity(organization);
  const hasContact = showSellerContact && (organization?.phone || contactPerson);
  const initials = (sellerName || 'П').substring(0, 2).toUpperCase();

  return (
    <Card as="section" padding="sm">
      <h2 className="mb-3 text-sm font-semibold text-ink">Продавец</h2>

      <div className="mb-3 flex items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 overflow-hidden rounded-full ${
            logoUrl ? 'border border-line bg-surface' : 'bg-brand-600'
          }`}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={sellerName || 'Логотип продавца'}
              className="h-full w-full object-contain p-0.5"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
              {initials}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {sellerName ? (
            <p className="truncate text-sm font-semibold text-ink">{sellerName}</p>
          ) : null}
          {contactPerson ? (
            <p className="truncate text-xs text-ink-muted">{contactPerson}</p>
          ) : null}
          {city ? (
            <p className="mt-0.5 truncate text-xs text-ink-muted">{city}</p>
          ) : null}
        </div>
      </div>

      {organization?.id ? (
        <Link
          to={`/organizations/${organization.id}`}
          className="mb-3 inline-flex text-sm font-medium text-brand-600 hover:text-brand-800"
        >
          Перейти в магазин
        </Link>
      ) : null}

      {hasContact ? (
        <div className="flex flex-col gap-2">
          {organization?.phone ? (
            <Button
              type="button"
              onClick={onPhoneClick}
              variant="soft"
              className="w-full"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Позвонить
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={onWriteClick}
            disabled={creatingChat}
            className="w-full"
          >
            {creatingChat ? 'Создание чата…' : 'Написать'}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
