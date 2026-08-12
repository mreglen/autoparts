import { act, renderHook } from '@testing-library/react';
import useSpotlightTour from './useSpotlightTour';

const STEPS = [
  { id: 'a', title: 'A', body: 'Step A' },
  { id: 'b', title: 'B', body: 'Step B' },
  { id: 'c', title: 'C', body: 'Step C' },
];

describe('useSpotlightTour', () => {
  test('starts inactive with zero-based first step', () => {
    const { result } = renderHook(() => useSpotlightTour({ steps: STEPS }));
    expect(result.current.active).toBe(false);
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.totalSteps).toBe(3);
    expect(result.current.currentStep).toBeNull();
  });

  test('navigates forward and backward through steps', async () => {
    const { result } = renderHook(() => useSpotlightTour({ steps: STEPS }));

    await act(async () => {
      await result.current.startTour();
    });
    expect(result.current.active).toBe(true);
    expect(result.current.currentStep?.id).toBe('a');
    expect(result.current.isFirstStep).toBe(true);
    expect(result.current.isLastStep).toBe(false);

    await act(async () => {
      await result.current.goNext();
    });
    expect(result.current.currentStep?.id).toBe('b');
    expect(result.current.isFirstStep).toBe(false);

    await act(async () => {
      await result.current.goPrev();
    });
    expect(result.current.currentStep?.id).toBe('a');
  });

  test('completes tour on last step and calls onComplete', async () => {
    const onComplete = jest.fn();
    const { result } = renderHook(() => useSpotlightTour({ steps: STEPS, onComplete }));

    await act(async () => {
      await result.current.startTour();
    });
    await act(async () => {
      await result.current.goNext();
    });
    await act(async () => {
      await result.current.goNext();
    });
    expect(result.current.currentStep?.id).toBe('c');
    expect(result.current.isLastStep).toBe(true);

    await act(async () => {
      await result.current.goNext();
    });

    expect(result.current.active).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('skipTour calls onSkip and resets state', async () => {
    const onSkip = jest.fn();
    const { result } = renderHook(() => useSpotlightTour({ steps: STEPS, onSkip }));

    await act(async () => {
      await result.current.startTour();
    });
    await act(async () => {
      await result.current.skipTour();
    });

    expect(result.current.active).toBe(false);
    expect(result.current.stepIndex).toBe(0);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  test('skipCurrentStep advances without completing tour', async () => {
    const onComplete = jest.fn();
    const { result } = renderHook(() => useSpotlightTour({ steps: STEPS, onComplete }));

    await act(async () => {
      await result.current.startTour();
    });
    await act(async () => {
      await result.current.skipCurrentStep();
    });

    expect(result.current.active).toBe(true);
    expect(result.current.currentStep?.id).toBe('b');
    expect(onComplete).not.toHaveBeenCalled();
  });

  test('goPrev does nothing on first step', async () => {
    const { result } = renderHook(() => useSpotlightTour({ steps: STEPS }));

    await act(async () => {
      await result.current.startTour();
    });
    await act(async () => {
      await result.current.goPrev();
    });

    expect(result.current.currentStep?.id).toBe('a');
  });
});
