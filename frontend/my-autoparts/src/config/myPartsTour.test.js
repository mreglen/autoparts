import { buildMyPartsSteps, MY_PARTS_TOUR_STEP_IDS } from './myPartsTour';

describe('buildMyPartsSteps', () => {
  test('returns 9 steps without QR by default', () => {
    const steps = buildMyPartsSteps();
    expect(steps).toHaveLength(9);
    expect(steps.map((step) => step.id)).toEqual([
      MY_PARTS_TOUR_STEP_IDS.HEADER,
      MY_PARTS_TOUR_STEP_IDS.ADD,
      MY_PARTS_TOUR_STEP_IDS.TABS_IN_STOCK,
      MY_PARTS_TOUR_STEP_IDS.TABS_MODERATION,
      MY_PARTS_TOUR_STEP_IDS.TABS_DRAFTS,
      MY_PARTS_TOUR_STEP_IDS.SEARCH,
      MY_PARTS_TOUR_STEP_IDS.FILTERS,
      MY_PARTS_TOUR_STEP_IDS.TOOLBAR,
      MY_PARTS_TOUR_STEP_IDS.ROW,
    ]);
  });

  test('includes QR step when showQr is true', () => {
    const steps = buildMyPartsSteps({ showQr: true });
    expect(steps).toHaveLength(10);
    expect(steps[steps.length - 1].id).toBe(MY_PARTS_TOUR_STEP_IDS.QR);
  });

  test('filters step opens and closes filter panel via callbacks', async () => {
    const onOpenFilters = jest.fn();
    const onCloseFilters = jest.fn();
    const onSwitchTab = jest.fn();
    const steps = buildMyPartsSteps({ onOpenFilters, onCloseFilters, onSwitchTab });
    const filtersStep = steps.find((step) => step.id === MY_PARTS_TOUR_STEP_IDS.FILTERS);

    await filtersStep.beforeEnter();
    expect(onSwitchTab).toHaveBeenCalledWith('in-stock');
    expect(onOpenFilters).toHaveBeenCalledTimes(1);

    await filtersStep.afterLeave();
    expect(onCloseFilters).toHaveBeenCalledTimes(1);
  });

  test('tab steps switch to the expected sections', async () => {
    const onSwitchTab = jest.fn();
    const steps = buildMyPartsSteps({ onSwitchTab });

    await steps.find((step) => step.id === MY_PARTS_TOUR_STEP_IDS.TABS_MODERATION).beforeEnter();
    expect(onSwitchTab).toHaveBeenCalledWith('pending');

    await steps.find((step) => step.id === MY_PARTS_TOUR_STEP_IDS.TABS_DRAFTS).beforeEnter();
    expect(onSwitchTab).toHaveBeenCalledWith('drafts');
  });

  test('row step opens row actions when parts exist', async () => {
    const onSetRowActionsOpen = jest.fn();
    const steps = buildMyPartsSteps({ hasParts: true, onSetRowActionsOpen });
    const rowStep = steps.find((step) => step.id === MY_PARTS_TOUR_STEP_IDS.ROW);

    await rowStep.beforeEnter();
    expect(onSetRowActionsOpen).toHaveBeenCalledWith(true);

    await rowStep.afterLeave();
    expect(onSetRowActionsOpen).toHaveBeenCalledWith(false);
  });

  test('row step uses custom footer marker', () => {
    const steps = buildMyPartsSteps();
    const rowStep = steps.find((step) => step.id === MY_PARTS_TOUR_STEP_IDS.ROW);
    expect(rowStep.customFooter).toBe('row');
  });
});
