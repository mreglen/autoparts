import { useCallback, useEffect, useRef, useState } from 'react';

const SPOTLIGHT_PADDING = 4;
const TARGET_Z_INDEX = 121;
const TARGET_ATTR = 'data-spotlight-active';

function getTargetElement(step) {
  if (!step?.target) return null;
  if (typeof step.target === 'string') {
    return document.querySelector(step.target);
  }
  return step.target;
}

function parseBorderRadius(element, width, height) {
  const style = window.getComputedStyle(element);
  const corners = [
    style.borderTopLeftRadius,
    style.borderTopRightRadius,
    style.borderBottomRightRadius,
    style.borderBottomLeftRadius,
  ].map((value) => parseFloat(value) || 0);
  const maxCorner = Math.max(...corners);
  const cap = Math.min(width, height) / 2;
  if (maxCorner >= cap || maxCorner > 999) {
    return cap;
  }
  return maxCorner;
}

function measureTarget(element, padding = SPOTLIGHT_PADDING) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 && rect.height <= 0) return null;

  const width = Math.round(rect.width + padding * 2);
  const height = Math.round(rect.height + padding * 2);
  const top = Math.round(rect.top - padding);
  const left = Math.round(rect.left - padding);
  const borderRadius = Math.round(
    Math.min(parseBorderRadius(element, width, height), width / 2, height / 2),
  );

  return {
    top,
    left,
    width,
    height,
    borderRadius,
  };
}

function applyTargetHighlight(element) {
  if (!element) return () => {};
  const prev = {
    position: element.style.position,
    zIndex: element.style.zIndex,
  };
  const computed = window.getComputedStyle(element);
  if (computed.position === 'static') {
    element.style.position = 'relative';
  }
  element.style.zIndex = String(TARGET_Z_INDEX);
  element.setAttribute(TARGET_ATTR, 'true');
  return () => {
    element.style.position = prev.position;
    element.style.zIndex = prev.zIndex;
    element.removeAttribute(TARGET_ATTR);
  };
}

export default function useSpotlightTour({ steps = [], onComplete, onSkip }) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const cleanupRef = useRef(null);
  const stepsRef = useRef(steps);

  stepsRef.current = steps;

  const currentStep = active && steps[stepIndex] ? steps[stepIndex] : null;
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex >= steps.length - 1;

  const clearHighlight = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
  }, []);

  const updateSpotlight = useCallback(() => {
    const step = stepsRef.current[stepIndex];
    const element = getTargetElement(step);
    if (!element) {
      setSpotlightRect(null);
      return;
    }
    setSpotlightRect(measureTarget(element));
  }, [stepIndex]);

  const enterStep = useCallback(async (index) => {
    clearHighlight();
    const step = stepsRef.current[index];
    if (!step) return;

    if (step.beforeEnter) {
      await step.beforeEnter();
    }

    let element = getTargetElement(step);
    for (let attempt = 0; attempt < 12 && (!element || element.getBoundingClientRect().width <= 0); attempt += 1) {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 50);
      });
      element = getTargetElement(step);
    }

    if (element) {
      element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      await new Promise((resolve) => {
        window.setTimeout(resolve, 150);
      });
      cleanupRef.current = applyTargetHighlight(element);
      setSpotlightRect(measureTarget(element));
    } else {
      setSpotlightRect(null);
    }
  }, [clearHighlight]);

  const leaveStep = useCallback(async (index) => {
    const step = stepsRef.current[index];
    if (step?.afterLeave) {
      await step.afterLeave();
    }
    clearHighlight();
  }, [clearHighlight]);

  const stopTour = useCallback(async () => {
    await leaveStep(stepIndex);
    setActive(false);
    setStepIndex(0);
    setSpotlightRect(null);
  }, [leaveStep, stepIndex]);

  const startTour = useCallback(async () => {
    if (!stepsRef.current.length) return;
    clearHighlight();
    setStepIndex(0);
    setSpotlightRect(null);
    setActive(true);
    await enterStep(0);
  }, [clearHighlight, enterStep]);

  const completeTour = useCallback(async () => {
    await stopTour();
    onComplete?.();
  }, [onComplete, stopTour]);

  const skipTour = useCallback(async () => {
    await stopTour();
    onSkip?.();
  }, [onSkip, stopTour]);

  const goNext = useCallback(async () => {
    if (isLastStep) {
      await completeTour();
      return;
    }
    await leaveStep(stepIndex);
    const nextIndex = stepIndex + 1;
    setStepIndex(nextIndex);
    await enterStep(nextIndex);
  }, [completeTour, enterStep, isLastStep, leaveStep, stepIndex]);

  const goPrev = useCallback(async () => {
    if (isFirstStep) return;
    await leaveStep(stepIndex);
    const prevIndex = stepIndex - 1;
    setStepIndex(prevIndex);
    await enterStep(prevIndex);
  }, [enterStep, isFirstStep, leaveStep, stepIndex]);

  const skipCurrentStep = useCallback(async () => {
    await goNext();
  }, [goNext]);

  useEffect(() => {
    if (!active) return undefined;

    const onResize = () => updateSpotlight();
    const onScroll = () => updateSpotlight();

    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [active, updateSpotlight, stepIndex]);

  useEffect(() => {
    if (!active) return undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        skipTour();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
      clearHighlight();
    };
  }, [active, clearHighlight, skipTour]);

  return {
    active,
    currentStep,
    stepIndex,
    totalSteps: steps.length,
    spotlightRect,
    isFirstStep,
    isLastStep,
    startTour,
    stopTour,
    goNext,
    goPrev,
    skipTour,
    skipCurrentStep,
    completeTour,
  };
}

export { getTargetElement, measureTarget, SPOTLIGHT_PADDING };
