import AutoserviceClientRequisitesFields from './AutoserviceClientRequisitesFields';
import { isGuestClient } from '../../utils/autoserviceClientRequisites';

export default function AutoserviceDocumentClientEditor({
  client,
  form,
  onChange,
  disabled = false,
  idPrefix = 'doc-client',
}) {
  if (!client) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3">
      <p className="mb-1 text-sm font-semibold text-gray-900">Клиент</p>
      <p className="mb-3 text-xs text-gray-500">
        Подсказки относятся только к этому клиенту. Новые данные сохраняются в его карточку.
      </p>
      <AutoserviceClientRequisitesFields
        form={form}
        onChange={onChange}
        isGuest={isGuestClient(client)}
        disabled={disabled}
        idPrefix={idPrefix}
      />
    </div>
  );
}
