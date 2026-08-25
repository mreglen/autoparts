import { render, screen } from '@testing-library/react';
import ProductDetailStickyBar from './ProductDetailStickyBar';

describe('ProductDetailStickyBar', () => {
  it('renders children and price summary', () => {
    render(
      <ProductDetailStickyBar priceLabel="Цена" priceValue="1 250 ₽" meta="3 шт.">
        <button type="button">В корзину</button>
      </ProductDetailStickyBar>,
    );
    expect(screen.getByRole('region', { name: 'Действия с товаром' })).toBeTruthy();
    expect(screen.getByText('1 250 ₽')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'В корзину' })).toBeTruthy();
  });

  it('applies sticky z-index token', () => {
    const { container } = render(
      <ProductDetailStickyBar>
        <span>CTA</span>
      </ProductDetailStickyBar>,
    );
    expect(String(container.firstChild.style.zIndex)).toBe('45');
  });
});
