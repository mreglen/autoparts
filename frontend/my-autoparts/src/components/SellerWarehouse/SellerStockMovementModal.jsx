import React from 'react';
import Modal from '../UI/Modal';
import PhotoThumbnail from '../PhotoGallery/PhotoThumbnail';
import { stripHtmlTags } from '../../utils/text';

const money = (value) => `${Number(value || 0).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₽`;
const date = (value) => (value ? new Date(value).toLocaleDateString('ru-RU') : '—');
const storage = (row) => row?.storage_location?.address || (row?.storage_location_id ? `Склад #${row.storage_location_id}` : '—');

function MovementList({ title, rows, type }) {
  if (!rows?.length) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold text-ink">{title}</h3>
      <div className="overflow-hidden rounded-sg border border-line-soft">
        <table className="min-w-full table-fixed divide-y divide-line-soft text-xs">
          <thead>
            <tr className="bg-surface-subtle text-left font-semibold uppercase tracking-wide text-ink-muted">
              <th className="w-24 px-3 py-2">Дата</th>
              <th className="w-20 px-3 py-2 text-right">Кол-во</th>
              <th className="w-24 px-3 py-2 text-right">Цена</th>
              <th className="px-3 py-2">Хранение</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {rows.map((row) => (
              <tr key={`${type}-${row.id}`}>
                <td className="px-3 py-2 text-ink-muted">{date(type === 'in' ? row.created_at : row.movement_date)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.quantity} шт.</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(row.sale_price)}</td>
                <td className="truncate px-3 py-2" title={storage(row)}>{storage(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SellerStockMovementModal({ row, type, stockIns, stockOuts, onClose, onImageClick, onReturn }) {
  const product = row?.product || {};
  if (!row) return null;
  const relatedIns = (stockIns || []).filter((item) => item.product_id === row.product_id);
  const relatedOuts = (stockOuts || []).filter((item) => item.product_id === row.product_id);
  const operationDate = type === 'in' ? row.created_at : row.movement_date;
  const total = Number(row.quantity || 0) * Number(row.sale_price || 0);

  return (
    <Modal open={Boolean(row)} onClose={onClose} title={`${type === 'in' ? 'Поступление' : 'Расход'} · ${product.name || '—'}`} size="lg">
      <div className="space-y-4 text-xs">
        {(product.photos?.length || product.videos?.length) ? (
          <PhotoThumbnail photos={product.photos || []} videos={product.videos || []} onImageClick={onImageClick} />
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <p><span className="text-ink-muted">Дата:</span> {date(operationDate)}</p>
          <p><span className="text-ink-muted">Кол-во:</span> {row.quantity} шт.</p>
          <p><span className="text-ink-muted">{type === 'in' ? 'Закупочная цена:' : 'Цена продажи:'}</span> {money(row.sale_price)}</p>
          <p><span className="text-ink-muted">Сумма:</span> <span className="font-semibold tabular-nums">{money(total)}</span></p>
          <p><span className="text-ink-muted">Бренд:</span> {product.brand || '—'}</p>
          <p><span className="text-ink-muted">Артикул:</span> {product.article || '—'}</p>
          <p className="col-span-2"><span className="text-ink-muted">Адресное хранение:</span> {storage(row)}</p>
          <p className="col-span-2"><span className="text-ink-muted">Остаток товара:</span> {Number(product.quantity || 0)} шт.</p>
          {type === 'out' && row.reason ? <p className="col-span-2"><span className="text-ink-muted">Причина:</span> {row.reason}</p> : null}
          {product.description ? <p className="col-span-2"><span className="text-ink-muted">Описание:</span> {stripHtmlTags(product.description)}</p> : null}
        </div>
        <MovementList title="Поступления" rows={relatedIns} type="in" />
        <MovementList title="Продажи и списания" rows={relatedOuts} type="out" />
        <div className="flex flex-wrap justify-end gap-2 border-t border-line-soft pt-3">
          <button type="button" onClick={onClose} className="inline-flex h-10 items-center justify-center rounded-sg-sm border border-line-strong bg-surface px-4 text-xs font-medium text-ink-soft hover:bg-surface-muted">Закрыть</button>
          {type === 'out' && onReturn ? <button type="button" onClick={() => onReturn(row)} className="inline-flex h-10 items-center justify-center rounded-sg-sm bg-brand-600 px-4 text-xs font-semibold text-white hover:bg-brand-700">Вернуть на склад</button> : null}
        </div>
      </div>
    </Modal>
  );
}
