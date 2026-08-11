import { formatOrderTimeRange } from './autoserviceOrderDisplay';

describe('autoserviceOrderDisplay', () => {
  it('shows end time when present', () => {
    const text = formatOrderTimeRange({
      scheduled_at: '2026-08-11T10:00:00',
      scheduled_end_at: '2026-08-11T12:00:00',
    });
    expect(text).toContain('—');
  });

  it('shows missing end label when end is absent', () => {
    const text = formatOrderTimeRange({
      scheduled_at: '2026-08-11T10:00:00',
      scheduled_end_at: null,
    });
    expect(text).toContain('Окончание не указано');
  });
});
