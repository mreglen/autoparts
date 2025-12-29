import React from 'react';

function Map() {
    return (
        <div className="w-full mt-16 sm:mt-36">
            {/* Заголовок и адрес */}
            <div className="flex flex-col sm:flex-row justify-between mb-6 sm:mb-10">
                <h1 className="font-extrabold text-3xl sm:text-4xl">Как добраться</h1>
                <p className="font-medium text-lg sm:text-xl mt-4 sm:mt-0">
                    п. Ягодный, ул. Фруктовая 17
                </p>
            </div>

            {/* Карта */}
            <div
                style={{
                    position: 'relative',
                    overflow: 'hidden',
                    width: '100%',
                    height: '300px', // Меньшая высота для мобильных устройств
                    borderRadius: '8px',
                }}
                className="sm:h-96 rounded-md"
            >
                <iframe
                    src="https://yandex.ru/map-widget/v1/?display-text=%D0%B0%D0%B2%D1%82%D0%BE%D1%81%D0%B5%D1%80%D0%B2%D0%B8%D1%81&ll=60.674303%2C56.938405&mode=search&oid=213329928692&ol=biz&sll=60.672271%2C56.938363&sspn=0.009563%2C0.002958&text=%D0%B0%D0%B2%D1%82%D0%BE%D1%81%D0%B5%D1%80%D0%B2%D0%B8%D1%81&z=17.02"
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    allowFullScreen="true"
                    style={{ position: 'relative' }}
                    className="rounded-md"
                />
            </div>
        </div>
    );
}

export default Map;