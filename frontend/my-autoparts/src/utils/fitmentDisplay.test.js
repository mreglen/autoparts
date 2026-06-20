import {
  buildDonorLabel,
  buildVehicleSubtitle,
  buildVehicleTitle,
  dedupeCompatibilityAgainstDonors,
  getDonorCaption,
  hasDonorDetails,
} from './fitmentDisplay';
import { splitFitmentForDisplay } from './mergeProductFitment';

describe('fitmentDisplay', () => {
  test('buildVehicleTitle joins brand and model', () => {
    expect(buildVehicleTitle({ brand: 'Toyota', model: 'Camry' })).toBe('Toyota Camry');
  });

  test('buildDonorLabel prefers TecDoc passengercar description', () => {
    const label = buildDonorLabel({
      brand: 'Toyota',
      model: 'Camry',
      tecdoc_passengercar_json: { FullDescription: 'Toyota Camry 2.5 (2018—)' },
    });
    expect(label).toBe('Toyota Camry 2.5 (2018—)');
  });

  test('getDonorCaption switches for modification details', () => {
    expect(getDonorCaption({ brand: 'Toyota', model: 'Camry' })).toBe('Запчасть снята с этого автомобиля');
    expect(getDonorCaption({ brand: 'Toyota', model: 'Camry', engine: '2.5' })).toBe(
      'Запчасть снята с такой модификации',
    );
  });

  test('hasDonorDetails requires brand and model-level info', () => {
    expect(hasDonorDetails({ brand: 'Toyota' })).toBe(false);
    expect(hasDonorDetails({ brand: 'Toyota', model: 'Camry' })).toBe(true);
  });
});

describe('splitFitmentForDisplay', () => {
  test('keeps seller vehicles separate and dedupes reference list', () => {
    const seller = [{ brand: 'Toyota', model: 'Camry', generation: 'XV70' }];
    const reference = [
      { brand: 'Toyota', model: 'Camry', generation: 'XV70', source: 'reference' },
      { brand: 'Lexus', model: 'ES', source: 'tecdoc' },
    ];
    const { donors, compatibility } = splitFitmentForDisplay(seller, reference);
    expect(donors).toHaveLength(1);
    expect(donors[0].source).toBe('seller');
    expect(compatibility).toHaveLength(1);
    expect(compatibility[0].model).toBe('ES');
  });

  test('buildVehicleSubtitle joins meta fields', () => {
    expect(
      buildVehicleSubtitle({ generation: 'XV70', engine: '2.5', transmission: 'AT' }),
    ).toBe('XV70 · 2.5 · AT');
  });

  test('dedupeCompatibilityAgainstDonors removes donor duplicates', () => {
    const donors = [{ brand: 'Toyota', model: 'Camry', generation: 'XV70' }];
    const compatibility = dedupeCompatibilityAgainstDonors(donors, [
      { brand: 'Toyota', model: 'Camry', generation: 'XV70' },
      { brand: 'Lexus', model: 'ES' },
    ]);
    expect(compatibility).toHaveLength(1);
    expect(compatibility[0].model).toBe('ES');
  });
});
