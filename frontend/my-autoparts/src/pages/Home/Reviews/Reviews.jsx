import React from 'react';

function Reviews() {
    return (
        <div className='w-full mt-40 bg-white'> {/* Добавляем bg-white для белого фона */}
            {/* Блок с отзывами */}
            <div style={{
                width: '100%', // Растягиваем на всю ширину
                height: '700px', // Уменьшаем высоту в полтора раза (800 / 1.5)
                overflow: 'hidden',
                position: 'relative'
            }}>
                {/* Виджет Яндекс.Карт */}
                <iframe
                    style={{
                        width: '100%', // Растягиваем iframe на всю ширину
                        height: '100%', // Растягиваем iframe на всю высоту
                        border: 'none', // Убираем рамку iframe
                        borderRadius: 8,
                        boxSizing: 'border-box'
                    }}
                    src="https://yandex.ru/maps-reviews-widget/213329928692?comments"
                    title="Отзывы о автосервисе на Яндекс.Картах"
                />
                {/* Ссылка под виджетом */}
                <a
                    href="https://yandex.ru/maps/org/svoy_garazh/213329928692/"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                        boxSizing: 'border-box',
                        textDecoration: 'none',
                        color: '#b3b3b3',
                        fontSize: 10,
                        fontFamily: 'YS Text,sans-serif',
                        padding: '0 16px',
                        position: 'absolute',
                        bottom: 8,
                        width: '100%',
                        textAlign: 'center',
                        left: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'block',
                        maxHeight: 14,
                        whiteSpace: 'nowrap'
                    }}
                >
                    Свой гараж на карте Екатеринбурга — Яндекс&nbsp;Карты
                </a>
            </div>
        </div>
    );
}

export default Reviews;