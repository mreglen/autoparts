import Modal from '../UI/Modal';

function ChoiceCard({ icon, title, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full min-h-11 items-center gap-3 rounded-sg border border-line bg-surface px-4 py-3.5 text-left transition hover:border-brand-300 hover:bg-brand-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sg-sm bg-brand-100 text-lg font-semibold text-brand-700">
        {icon}
      </span>
      <span className="text-sm font-semibold text-ink">{title}</span>
    </button>
  );
}

export default function PlannerCreateChoiceModal({ open, onClose, onChooseOrder, onChooseInspection }) {
  return (
    <Modal open={open} onClose={onClose} title="Создать" size="sm">
      <div className="space-y-2">
        <ChoiceCard
          icon="+"
          title="Заказ-наряд"
          onClick={onChooseOrder}
        />
        <ChoiceCard
          icon="+"
          title="Запись на осмотр"
          onClick={onChooseInspection}
        />
      </div>
    </Modal>
  );
}
