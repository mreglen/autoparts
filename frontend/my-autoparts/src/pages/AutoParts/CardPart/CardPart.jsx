import React, { useState, Fragment, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addNewPartsToCart, selectCartLoading, selectCart, updateCartItemQuantity, removeFromCart } from '../../../redux/slices/CartSlice';
import { selectToken } from '../../../redux/slices/AuthSlice';


const formatDeliveryTime = (deliveryStart, deliveryEnd) => {
    if (!deliveryStart || !deliveryEnd) return '—';

    try {
        const startDate = new Date(deliveryStart);
        const endDate = new Date(deliveryEnd);

        const dayText = startDate.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        const startTime = startDate.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
        const endTime = endDate.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });

        return `${dayText} с ${startTime} до ${endTime}`;
    } catch (error) {
        console.error('Error formatting delivery time:', error);
        return '—';
    }
};

function CardPart({ part, stocksData, showAllStocks = false, expandedPartId, onToggleExpand, sectionType = '', uniqueId }) {
    const dispatch = useDispatch();
    const cartLoading = useSelector(selectCartLoading);

    // Определяем статус авторизации
    const token = useSelector(selectToken);
    const isAuthenticated = !!token;

    // Выбираем соответствующие селекторы
    const cart = useSelector(selectCart);

    // Используем только переданные данные складов
    const partStockData = stocksData ? { stocks: stocksData } : null;

    // Получаем данные о складах
    const allStocks = partStockData?.stocks || [];
    // Фильтруем склады, у которых есть цена и она не равна 0, есть delivery
    const stocks = allStocks.filter(stock =>
      stock?.price &&
      stock.price !== '0' &&
      stock.price !== 0 &&
      stock.available_count > 0
    );
    const mainStock = stocks[0];
    const otherStocks = stocks.slice(1);

    const brand = part.brand || '—';
    const number = part.partnumber || '—';
    const title = part.name || '—';

    const [expanded, setExpanded] = useState(false);
    const [addingToCart, setAddingToCart] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const isLongTitle = title && title.length > 100;
    const isExpanded = expandedPartId === uniqueId;

    // Загрузка данных о складах при монтировании компонента больше не нужна

    // Получаем количество товара в корзине
    const getCartQuantity = (stock) => {
        const cartItems = cart?.new_parts_items;
        if (!cartItems) return 0;

        const stockId = stock.stock_id;
        const cartItem = cartItems.find(item =>
            item.stock_id === stockId &&
            item.brand === brand &&
            item.partnumber === number
        );

        return cartItem ? cartItem.quantity : 0;
    };

    // Получаем информацию о наличии товара на складах
    const getStockAvailability = (currentStock) => {
        const availableOnCurrent = currentStock.available_count;
        const currentCartQuantity = getCartQuantity(currentStock);

        // Проверяем другие склады
        const otherStocks = stocks.filter(stock => stock.stock_id !== currentStock.stock_id);
        const hasStockOnOther = otherStocks.some(stock => stock.available_count > 0);

        return {
            availableOnCurrent,
            currentCartQuantity,
            hasStockOnOther,
            isLimited: currentCartQuantity >= availableOnCurrent,
            noStock: availableOnCurrent <= currentCartQuantity && !hasStockOnOther,
            limitedStock: currentCartQuantity >= availableOnCurrent && hasStockOnOther
        };
    };

    // Функция добавления в корзину
    const handleAddToCart = async (stock) => {
        setAddingToCart(true);
        try {
            const stockId = stock.stock_id;
            const currentCartQuantity = getCartQuantity(stock);
            const availableStock = stock.available_count;

            // Проверяем, есть ли доступный товар
            if (availableStock <= currentCartQuantity) {
                setAddingToCart(false);
                return;
            }

            // Добавляем 1 штуку, но не больше доступного
            const quantityToAdd = Math.min(1, availableStock - currentCartQuantity);

            const cartItem = {
                brand: brand,
                partnumber: number,
                name: title,
                delivery: formatDeliveryTime(stock.delivery_start, stock.delivery_end),
                quantity: quantityToAdd,
                price: parseFloat(calculatePriceWithMarkup(stock.price)),
                stock_id: stockId,
                guid: part?.guid,
                delivery_start: stock.delivery_start ? new Date(stock.delivery_start) : null,
                delivery_end: stock.delivery_end ? new Date(stock.delivery_end) : null
            };

            await dispatch(addNewPartsToCart(cartItem)).unwrap();
            // Можно добавить уведомление об успешном добавлении
        } catch (error) {
            console.error('Ошибка добавления в корзину:', error);
            // Можно добавить уведомление об ошибке
        } finally {
            setAddingToCart(false);
        }
    };

    // Функция уменьшения количества в корзине
    const handleRemoveFromCart = async (stock) => {
        setAddingToCart(true);
        try {
            const stockId = stock.stock_id;
            const cartItem = cart?.new_parts_items?.find(item =>
                item.stock_id === stockId &&
                item.brand === brand &&
                item.partnumber === number
            );

            if (cartItem) {
                if (cartItem.quantity > 1) {
                    // Уменьшаем количество
                    await dispatch(updateCartItemQuantity({ itemId: cartItem.id, quantity: cartItem.quantity - 1 })).unwrap();
                } else {
                    // Удаляем товар из корзины
                    await dispatch(removeFromCart(cartItem.id)).unwrap();
                }
            }
        } catch (error) {
            console.error('Ошибка изменения количества в корзине:', error);
        } finally {
            setAddingToCart(false);
        }
    };


    // Функция для расчета цены с наценкой 15%
    const calculatePriceWithMarkup = (price) => {
        if (!price || price === '—') return '—';
        const numericPrice = parseFloat(price);
        if (isNaN(numericPrice)) return price;
        return (numericPrice * 1.15).toFixed(2);
    };

    const renderMainRow = () => {
        
        if (!mainStock) {
            return null;
        }

        return (
            <tr className="hover:bg-gray-50">
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 w-20">{brand}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 w-24">{number}</td>
                <td className="px-4 py-2 text-sm text-gray-500 w-64">
                    {isLongTitle && !expanded ? (
                        <>
                            {title.slice(0, 100)}...
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setExpanded(true);
                                }}
                                className="ml-2 text-blue-500 text-sm underline"
                            >
                                Смотреть полностью
                            </button>
                        </>
                    ) : (
                        <>
                            {title}
                            {isLongTitle && expanded && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setExpanded(false);
                                    }}
                                    className="ml-2 text-blue-500 text-sm underline"
                                >
                                    Скрыть
                                </button>
                            )}
                        </>
                    )}
                </td>
                {/* <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 w-32">
                    <div className="flex flex-col">
                        <span>{mainStock?.description ?? '—'}</span>
                        {showAllStocks && stocks.length > 1 && (
                            <button
                                onClick={() => setExpanded(!expanded)}
                                className="text-sm text-blue-500 underline mt-1 text-left"
                            >
                                {expanded ? 'Скрыть склады' : 'Показать другие склады'}
                            </button>
                        )}
                    </div>
                </td> */}
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 w-36">
                    {formatDeliveryTime(mainStock?.delivery_start, mainStock?.delivery_end)}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 w-24">
                    <div className="flex flex-col">
                        <span>{mainStock?.available_count ?? '—'} шт.</span>
                        {showAllStocks && stocks.length > 1 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDetails(!showDetails);
                                }}
                                className="text-xs text-blue-500 underline mt-1 text-left"
                            >
                                {showDetails ? 'Скрыть' : 'Другие склады'}
                            </button>
                        )}
                    </div>
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 w-20">
                    {calculatePriceWithMarkup(mainStock?.price)}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 w-24">
                    {(() => {
                        const cartQuantity = getCartQuantity(mainStock);
                        const stockInfo = getStockAvailability(mainStock);
                        return cartQuantity > 0 ? (
                            <div className="flex items-center space-x-1">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveFromCart(mainStock);
                                    }}
                                    disabled={addingToCart || cartLoading}
                                    className="w-6 h-6 flex items-center justify-center text-xs font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                                >
                                    −
                                </button>
                                <span className="text-xs font-medium w-6 text-center">
                                    {cartQuantity}
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddToCart(mainStock);
                                    }}
                                    disabled={addingToCart || cartLoading || stockInfo.noStock}
                                    className="w-6 h-6 flex items-center justify-center text-xs font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                                >
                                    +
                                </button>
                                {(stockInfo.noStock || stockInfo.limitedStock) && (
                                    <div className="relative group">
                                        <svg className="w-4 h-4 text-orange-500 ml-1" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                                            {stockInfo.noStock
                                                ? 'Товара больше нет на этом и других складах'
                                                : 'Товара больше нет на этом складе, но есть на других'
                                            }
                                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddToCart(mainStock);
                                }}
                                disabled={addingToCart || cartLoading}
                                className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {addingToCart && (
                                    <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                )}
                                {addingToCart ? 'Добавление...' : 'В корзину'}
                            </button>
                        );
                    })()}
                </td>
            </tr>
        );
    };


    // Не показываем компонент, если нет складов с ценами
    if (!mainStock) {
        return null;
    }

    return (
        <Fragment>
            {renderMainRow()}

            {/* Дополнительные склады */}
            {showDetails && showAllStocks && stocks.length > 1 && otherStocks.map((stock, idx) => (
                <tr key={`stock-${idx}`} className="bg-gray-50 hover:bg-gray-100">
                    <td colSpan="3" className="px-4 py-2 text-sm text-gray-500">
                        {/* Объединяем бренд, номер и наименование */}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 w-36">
                        {formatDeliveryTime(stock?.delivery_start, stock?.delivery_end)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 w-24">
                        {stock?.available_count ?? '—'} шт.
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 w-20">
                        {calculatePriceWithMarkup(stock?.price)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 w-24">
                        {(() => {
                            const cartQuantity = getCartQuantity(stock);
                            const stockInfo = getStockAvailability(stock);
                            return cartQuantity > 0 ? (
                                <div className="flex items-center space-x-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveFromCart(stock);
                                        }}
                                        disabled={addingToCart || cartLoading}
                                        className="w-6 h-6 flex items-center justify-center text-xs font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                                    >
                                        −
                                    </button>
                                    <span className="text-xs font-medium w-6 text-center">
                                        {cartQuantity}
                                    </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleAddToCart(stock);
                                        }}
                                        disabled={addingToCart || cartLoading || stockInfo.noStock}
                                        className="w-6 h-6 flex items-center justify-center text-xs font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                                    >
                                        +
                                    </button>
                                    {(stockInfo.noStock || stockInfo.limitedStock) && (
                                        <div className="relative group">
                                            <svg className="w-4 h-4 text-orange-500 ml-1" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                                                {stockInfo.noStock
                                                    ? 'Товара больше нет на этом и других складах'
                                                    : 'Товара больше нет на этом складе, но есть на других'
                                                }
                                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddToCart(stock);
                                    }}
                                    disabled={addingToCart || cartLoading}
                                    className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {addingToCart && (
                                        <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    )}
                                    {addingToCart ? 'Добавление...' : 'В корзину'}
                                </button>
                            );
                        })()}
                    </td>
                </tr>
            ))}

        </Fragment>
    );
}

export default CardPart;