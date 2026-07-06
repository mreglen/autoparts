import { useMemo, useState } from 'react';
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
    [session, report, step]
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        aria-label="Закрыть"
        className="absolute inset-0 bg-black/40"
        onClick={handleClose}
      />
      <div className="relative w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Инвентаризация</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Шаг {stepIndex + 1} из {STEPS.length}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            {STEPS.map((id, idx) => (
              <div
                key={id}
                className={`h-1.5 flex-1 rounded-full ${idx <= stepIndex ? 'bg-indigo-600' : 'bg-gray-200'}`}
              />
            ))}
          </div>
        </div>

        <div className="px-4 sm:px-6 py-5">
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
        </div>
      </div>
    </div>
  );
}
