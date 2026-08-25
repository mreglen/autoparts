import { useMemo, useState } from 'react';
import Modal from '../UI/Modal';
import { InventoryWizardProvider } from './InventoryWizardContext';
import InventoryScopeStep from './InventoryScopeStep';
import InventoryCountStep from './InventoryCountStep';
import InventoryAdjustmentReport from './InventoryAdjustmentReport';
import InventoryCompleteStep from './InventoryCompleteStep';

const STEPS = ['scope', 'count', 'report', 'complete'];

export default function InventoryWizard({ open, onClose, onCompleted }) {
  const [step, setStep] = useState('scope');
  const [session, setSession] = useState(null);
  const [report, setReport] = useState(null);

  const stepIndex = STEPS.indexOf(step);

  const contextValue = useMemo(
    () => ({ session, setSession, report, setReport, step, setStep }),
    [session, report, step],
  );

  const handleClose = () => {
    setStep('scope');
    setSession(null);
    setReport(null);
    onClose();
  };

  const handleDone = () => {
    onCompleted?.();
    handleClose();
  };

  const modalTitle = (
    <div>
      <div className="text-lg font-semibold text-gray-900">Инвентаризация</div>
      <p className="text-xs text-gray-500 mt-0.5">
        Шаг {stepIndex + 1} из {STEPS.length}
      </p>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={modalTitle}
      size="lg"
      className="max-h-[92vh]"
    >
      <div className="mb-4 flex gap-2">
        {STEPS.map((id, idx) => (
          <div
            key={id}
            className={`h-1.5 flex-1 rounded-full ${idx <= stepIndex ? 'bg-indigo-600' : 'bg-gray-200'}`}
          />
        ))}
      </div>

      <InventoryWizardProvider value={contextValue}>
        {step === 'scope' && (
          <InventoryScopeStep
            onCancel={handleClose}
            onNext={(createdSession) => {
              setSession(createdSession);
              setStep('count');
            }}
          />
        )}
        {step === 'count' && session && (
          <InventoryCountStep
            session={session}
            onBack={() => setStep('scope')}
            onNext={(updatedSession) => {
              setSession(updatedSession);
              setStep('report');
            }}
          />
        )}
        {step === 'report' && session && (
          <InventoryAdjustmentReport
            session={session}
            onBack={() => setStep('count')}
            onNext={(loadedReport) => {
              setReport(loadedReport);
              setStep('complete');
            }}
          />
        )}
        {step === 'complete' && session && (
          <InventoryCompleteStep
            session={session}
            report={report}
            onBack={() => setStep('report')}
            onDone={handleDone}
          />
        )}
      </InventoryWizardProvider>
    </Modal>
  );
}
