import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SpotlightTour from '../../components/Onboarding/SpotlightTour';
import Button from '../../components/UI/Button';
import { buildMyPartsSteps, MY_PARTS_TOUR_STEP_IDS } from '../../config/myPartsTour';
import useSpotlightTour from '../../hooks/useSpotlightTour';
import {
  isOnboardingCompleted,
  markOnboardingCompleted,
  ONBOARDING_KEYS,
} from '../../utils/onboardingStorage';

const AUTO_START_DELAY_MS = 400;

export default function MyPartsOnboarding({
  canStart,
  hasParts,
  showQrStep,
  onOpenFilters,
  onCloseFilters,
  onSwitchTab,
  onSetRowActionsOpen,
  onResetTourUi,
  onTourActiveChange,
  startTourRef,
}) {
  const navigate = useNavigate();
  const autoStartedRef = useRef(false);

  const steps = useMemo(
    () => buildMyPartsSteps({
      showQr: showQrStep,
      hasParts,
      onSwitchTab,
      onOpenFilters,
      onCloseFilters,
      onSetRowActionsOpen,
    }),
    [
      showQrStep,
      hasParts,
      onSwitchTab,
      onOpenFilters,
      onCloseFilters,
      onSetRowActionsOpen,
    ],
  );

  const handleComplete = useCallback(() => {
    markOnboardingCompleted(ONBOARDING_KEYS.MY_PARTS);
    onResetTourUi?.();
  }, [onResetTourUi]);

  const {
    active,
    currentStep,
    stepIndex,
    totalSteps,
    spotlightRect,
    isFirstStep,
    isLastStep,
    startTour,
    goNext,
    goPrev,
    skipTour,
    skipCurrentStep,
    completeTour,
  } = useSpotlightTour({
    steps,
    onComplete: handleComplete,
    onSkip: handleComplete,
  });

  const handleStartTour = useCallback(
    async ({ force = false } = {}) => {
      if (!canStart && !force) return;
      onResetTourUi?.();
      await new Promise((resolve) => {
        window.setTimeout(resolve, 120);
      });
      await startTour();
    },
    [canStart, onResetTourUi, startTour],
  );

  useEffect(() => {
    onTourActiveChange?.(active);
  }, [active, onTourActiveChange]);

  useEffect(() => {
    if (startTourRef) {
      startTourRef.current = handleStartTour;
    }
  }, [handleStartTour, startTourRef]);

  useEffect(() => {
    if (!canStart || autoStartedRef.current) return undefined;
    if (isOnboardingCompleted(ONBOARDING_KEYS.MY_PARTS)) return undefined;

    autoStartedRef.current = true;
    const timer = window.setTimeout(() => {
      handleStartTour();
    }, AUTO_START_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [canStart, handleStartTour]);

  const handleRowAddPart = useCallback(async () => {
    await completeTour();
    navigate('/my-parts/add');
  }, [completeTour, navigate]);

  const handleRowSkipStep = useCallback(async () => {
    await skipCurrentStep();
  }, [skipCurrentStep]);

  const rowFooter = !hasParts ? (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <Button type="button" variant="ghost" size="sm" disabled={isFirstStep} onClick={goPrev}>
        Назад
      </Button>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="secondary" size="sm" onClick={handleRowSkipStep}>
          Пропустить шаг
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={handleRowAddPart}>
          Добавить запчасть
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-between gap-2">
      <Button type="button" variant="ghost" size="sm" disabled={isFirstStep} onClick={goPrev}>
        Назад
      </Button>
      <Button type="button" variant="primary" size="sm" onClick={goNext}>
        {isLastStep ? 'Готово' : 'Далее'}
      </Button>
    </div>
  );

  const customFooter = currentStep?.customFooter === 'row' ? rowFooter : null;

  return (
    <SpotlightTour
      open={active}
      step={currentStep}
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      spotlightRect={spotlightRect}
      isFirstStep={isFirstStep}
      isLastStep={isLastStep}
      onNext={goNext}
      onPrev={goPrev}
      onSkip={skipTour}
      customFooter={
        currentStep?.id === MY_PARTS_TOUR_STEP_IDS.ROW ? customFooter : null
      }
    />
  );
}
