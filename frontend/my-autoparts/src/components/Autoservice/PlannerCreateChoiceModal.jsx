import Modal from '../UI/Modal';

function ChoiceCard({ icon, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-lg font-semibold text-indigo-700">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900">{title}</span>
        <span className="mt-0.5 block text-xs text-gray-500">{description}</span>
      </span>
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
          description="Запись на ремонт с работами и запчастями"
          onClick={onChooseOrder}
        />
        <ChoiceCard
          icon="+"
          title="Запись на осмотр"
          description="Заявка на технический осмотр"
          onClick={onChooseInspection}
        />
      </div>
    </Modal>
  );
}
