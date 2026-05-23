import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PhotoThumbnail from '../../components/PhotoGallery/PhotoThumbnail';
import { stripHtmlTags } from '../../utils/text';
import { parseMediaList } from '../../utils/mediaHelpers';

function WorkspaceDetailShell({ isOpen, title, subtitle, onClose, children }) {
    useEffect(() => {
        if (!isOpen) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] overflow-y-auto">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
            <div className="flex min-h-full items-center justify-center p-4">
                <div
                    className="relative w-full max-w-3xl bg-white rounded-xl shadow-xl max-h-[90vh] flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 shrink-0">
                        <div className="min-w-0">
                            <h2 className="text-lg font-semibold text-gray-900 truncate">{title}</h2>
                            {subtitle && <p className="text-sm text-gray-500 mt-0.5 truncate">{subtitle}</p>}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                            aria-label="Закрыть"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div className="px-5 py-4 overflow-y-auto">{children}</div>
                </div>
            </div>
        </div>
    );
}

function DetailField({ label, value, mono }) {
    if (value == null || value === '') return null;
    return (
        <div>
            <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</dt>
            <dd className={`mt-1 text-sm text-gray-900 ${mono ? 'font-mono' : ''}`}>{value}</dd>
        </div>
    );
}

export function PartDetailContent({
    part,
    getStorageAddress,
    onImageClick,
    hideSiteLink = false,
    moderationKind = null,
}) {
    if (!part) return null;

    const priceLabel = part.price != null && !Number.isNaN(Number(part.price))
        ? `${Number(part.price).toLocaleString('ru-RU')} ₽`
        : '—';

    const storageLabel = part.storage_location?.address
        || part.storage_location_address
        || (part.storage_location_id && getStorageAddress?.(part.storage_location_id))
        || '—';

    return (
        <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                    {moderationKind === 'rejected' ? (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Отклонена
                        </span>
                    ) : moderationKind === 'pending' ? (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            На модерации
                        </span>
                    ) : (
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                            part.is_new ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}
                        >
                            {part.is_new ? 'Новый' : 'Б/у'}
                        </span>
                    )}
                    {!moderationKind && part.is_on_avito && (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Avito</span>
                    )}
                    {!moderationKind && part.is_on_drom && (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Drom</span>
                    )}
                </div>

                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <DetailField label="Остаток" value={`${part.quantity ?? 0} шт.`} />
                    <DetailField label="Цена" value={priceLabel} />
                    <DetailField label="Внутренний код" value={part.internal_code} mono />
                    <DetailField label="Склад" value={storageLabel} />
                    <DetailField label="Ответственный" value={part.creator_name} />
                    {moderationKind === 'rejected' && part.rejected_at && (
                        <DetailField label="Дата отклонения" value={new Date(part.rejected_at).toLocaleString('ru-RU')} />
                    )}
                    {moderationKind === 'pending' && part.created_at && (
                        <DetailField label="Дата отправки" value={new Date(part.created_at).toLocaleString('ru-RU')} />
                    )}
                </dl>

                {moderationKind === 'rejected' && part.rejection_reason && (
                    <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                        <h3 className="text-xs font-semibold text-red-800 uppercase tracking-wide mb-1">Причина отклонения</h3>
                        <p className="text-sm text-red-700">{part.rejection_reason}</p>
                    </div>
                )}

                {part.description && (
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Описание</h3>
                        <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
                            {stripHtmlTags(part.description)}
                        </p>
                    </div>
                )}

                {(parseMediaList(part.photos).length > 0 || parseMediaList(part.videos).length > 0) && (
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Фото и видео</h3>
                        <PhotoThumbnail
                            photos={parseMediaList(part.photos)}
                            videos={parseMediaList(part.videos)}
                            onImageClick={onImageClick}
                        />
                    </div>
                )}

                {part.compatible_vehicles?.length > 0 && (
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Совместимые автомобили</h3>
                        <div className="space-y-2">
                            {part.compatible_vehicles.map((vehicle) => (
                                <div key={vehicle.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm">
                                    <p className="font-medium text-gray-900">
                                        {vehicle.brand} {vehicle.model}
                                        {vehicle.generation ? ` · ${vehicle.generation}` : ''}
                                    </p>
                                    {(vehicle.engine || vehicle.transmission) && (
                                        <p className="text-gray-600 mt-1">
                                            {[vehicle.engine, vehicle.transmission].filter(Boolean).join(' · ')}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            {!hideSiteLink && part.id && !moderationKind && (
                <div className="pt-2 border-t border-gray-100">
                    <Link
                        to={`/part/${part.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                    >
                        Открыть карточку на сайте →
                    </Link>
                </div>
            )}
        </div>
    );
}

export function SellerPartDetailModal({ part, isOpen, onClose, getStorageAddress, onImageClick }) {
    if (!part) return null;

    return (
        <WorkspaceDetailShell
            isOpen={isOpen}
            onClose={onClose}
            title={`${part.brand || '—'} · ${part.article || '—'}`}
            subtitle={part.name}
        >
            <PartDetailContent
                part={part}
                getStorageAddress={getStorageAddress}
                onImageClick={onImageClick}
            />
        </WorkspaceDetailShell>
    );
}

export function ModerationProductViewModal({ product, isOpen, onClose, onImageClick }) {
    if (!product) return null;

    return (
        <WorkspaceDetailShell
            isOpen={isOpen}
            onClose={onClose}
            title={`${product.brand || '—'} · ${product.article || '—'}`}
            subtitle={product.name}
        >
            <PartDetailContent
                part={product}
                onImageClick={onImageClick}
                hideSiteLink
                moderationKind={product.moderationKind}
            />
        </WorkspaceDetailShell>
    );
}

function vehicleVin(vehicle) {
    return vehicle?.vin ?? vehicle?.vin_row?.vin ?? null;
}

function vehicleMileage(vehicle) {
    const m = vehicle?.mileage ?? vehicle?.mileage_row?.mileage;
    return m != null ? Number(m) : null;
}

export function SellerVehicleDetailModal({ vehicle, isOpen, onClose, getStorageAddress, onImageClick }) {
    if (!vehicle) return null;

    const vin = vehicleVin(vehicle);
    const mileage = vehicleMileage(vehicle);
    const priceLabel = vehicle.price != null && !Number.isNaN(Number(vehicle.price))
        ? `${Number(vehicle.price).toLocaleString('ru-RU')} ₽`
        : null;

    return (
        <WorkspaceDetailShell
            isOpen={isOpen}
            onClose={onClose}
            title={`${vehicle.brand || '—'} ${vehicle.model || ''}`.trim()}
            subtitle={vehicle.generation || undefined}
        >
            <div className="space-y-5">
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <DetailField label="Поколение" value={vehicle.generation} />
                    <DetailField label="Двигатель" value={vehicle.engine} />
                    <DetailField label="КПП" value={vehicle.transmission} />
                    <DetailField label="VIN" value={vin} mono />
                    <DetailField
                        label="Пробег"
                        value={mileage != null ? `${mileage.toLocaleString('ru-RU')} км` : null}
                    />
                    <DetailField label="Цена" value={priceLabel} />
                    <DetailField
                        label="Склад"
                        value={
                            vehicle.storage_location?.address
                            || (vehicle.storage_location_id && getStorageAddress?.(vehicle.storage_location_id))
                            || null
                        }
                    />
                </dl>

                {vehicle.description?.trim() && (
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Описание</h3>
                        <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
                            {stripHtmlTags(vehicle.description)}
                        </p>
                    </div>
                )}

                {vehicle.photos?.length > 0 && (
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Фото</h3>
                        <PhotoThumbnail photos={vehicle.photos} videos={[]} onImageClick={onImageClick} />
                    </div>
                )}
            </div>
        </WorkspaceDetailShell>
    );
}
