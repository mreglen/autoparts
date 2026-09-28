import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import VinCatalogUnitView from './VinCatalogUnitView';

const baseProps = {
  title: 'Тормозная система',
  imageUrl: null,
  imageMap: [],
  details: [],
  availability: {},
  hoverRowKey: null,
};

describe('VinCatalogUnitView', () => {
  it('shows every schema as a gallery and loads maps lazily', async () => {
    const onLoadSchemaImageMap = vi.fn();
    render(
      <VinCatalogUnitView
        {...baseProps}
        schemas={[
          { unit_id: 'front', name: 'Передние тормоза', image_url: '/front.png', imageMap: [], imageMapLoaded: false },
          { unit_id: 'rear', name: 'Задние тормоза', image_url: '/rear.png', imageMap: [], imageMapLoaded: false },
        ]}
        onLoadSchemaImageMap={onLoadSchemaImageMap}
      />
    );

    expect(screen.getByText('Схема 1 из 2')).toBeInTheDocument();
    expect(screen.getAllByText('Передние тормоза')).toHaveLength(2);
    await waitFor(() => expect(onLoadSchemaImageMap).toHaveBeenCalledWith(expect.objectContaining({ unit_id: 'front' })));

    fireEvent.click(screen.getByTitle('Задние тормоза'));
    expect(screen.getByText('Схема 2 из 2')).toBeInTheDocument();
    await waitFor(() => expect(onLoadSchemaImageMap).toHaveBeenCalledWith(expect.objectContaining({ unit_id: 'rear' })));
  });

  it('renders touch-friendly detail cards and opens a part', () => {
    const onSelectDetail = vi.fn();
    const detail = { detail_id: 'part-1', name: 'Масляный фильтр', oem: '68191349AC', code_on_image: '7' };
    render(
      <VinCatalogUnitView
        {...baseProps}
        details={[detail]}
        onSelectDetail={onSelectDetail}
      />
    );

    const card = screen.getByRole('button', { name: /Масляный фильтр/ });
    expect(card).toHaveClass('min-h-16');
    fireEvent.click(card);
    expect(onSelectDetail).toHaveBeenCalledWith(detail);
  });

  it('opens the selected schema in the fullscreen viewer', () => {
    render(
      <VinCatalogUnitView
        {...baseProps}
        schemas={[{ unit_id: 'one', name: 'Схема двигателя', image_url: '/engine.png', imageMap: [], imageMapLoaded: true }]}
      />
    );

    fireEvent.click(screen.getByText('Увеличить'));
    expect(screen.getAllByRole('button', { name: 'Увеличить' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Уменьшить' })).toBeInTheDocument();
    const viewer = screen.getByTestId('schema-touch-viewer');
    fireEvent.touchStart(viewer, { touches: [{ clientX: 100, clientY: 100 }, { clientX: 200, clientY: 100 }] });
    fireEvent.touchMove(viewer, { touches: [{ clientX: 50, clientY: 100 }, { clientX: 250, clientY: 100 }] });
    expect(screen.getByText('200%')).toBeInTheDocument();
    fireEvent.touchEnd(viewer, { touches: [] });
    fireEvent.click(screen.getByText('Закрыть'));
    expect(screen.queryByText('Закрыть')).not.toBeInTheDocument();
  });
});
