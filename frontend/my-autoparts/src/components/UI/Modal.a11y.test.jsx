import React from 'react';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ConfirmDialog } from './Modal';

expect.extend(toHaveNoViolations);

describe('Modal accessibility', () => {
  it('ConfirmDialog has no serious or critical axe violations', async () => {
    const { container } = render(
      <ConfirmDialog
        open
        onClose={() => {}}
        onConfirm={() => {}}
        title="Удалить товар?"
        message="Действие необратимо."
      />,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
