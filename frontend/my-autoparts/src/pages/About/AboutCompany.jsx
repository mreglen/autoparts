import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPublicSiteConfig } from '../../redux/slices/PublicInfoSlice';

const LEGAL = {
    fullName: 'Общество с ограниченной ответственностью «Кроан»',
    shortName: 'ООО «Кроан»',
    ogrn: '1226600004278',
    inn: '6684041317',
    kpp: '668601001',
    registeredAt: '28.01.2022',
    charterCapital: '10 000 ₽',
    legalAddress: '620907, Свердловская область, г. Екатеринбург, ул. Фруктовая, соор. 17',
    director: 'Кропотухина Анна Андреевна',
    mainActivity: 'Техническое обслуживание и ремонт автотранспортных средств (ОКВЭД 45.20)',
    rusprofileUrl: 'https://www.rusprofile.ru/id/1226600004278',
};

function formatPhone(phone) {
    if (!phone) return null;
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('8')) digits = `7${digits.slice(1)}`;
    if (!digits.startsWith('7') && digits.length === 10) digits = `7${digits}`;
    if (digits.length < 11) return phone;
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
}

function InfoRow({ label, value, mono }) {
    return (
        <div className="py-3 border-b border-gray-100 last:border-0">
            <dt className="text-sm text-gray-500 mb-0.5">{label}</dt>
            <dd className={`text-gray-900 ${mono ? 'font-mono text-sm' : ''}`}>{value}</dd>
        </div>
    );
}

export default function AboutCompany() {
    const dispatch = useDispatch();
    const { adminOrganizationPhone } = useSelector((state) => state.publicInfo);
    const phone = adminOrganizationPhone?.organization_phone;
    const phoneFormatted = formatPhone(phone);
    const telHref = phone ? `tel:${phone.replace(/\D/g, '')}` : null;

    useEffect(() => {
        dispatch(fetchPublicSiteConfig());
    }, [dispatch]);

    return (
        <div className="max-w-4xl mx-auto">
            <nav className="text-sm text-gray-500 mb-6">
                <Link to="/" className="hover:text-indigo-600">Главная</Link>
                <span className="mx-2">/</span>
                <span className="text-gray-900">О компании</span>
            </nav>

            <header className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">О компании</h1>
                <p className="mt-3 text-gray-600 leading-relaxed">
                    Интернет-магазин <strong className="text-gray-900">«Свой Гараж»</strong> работает под управлением{' '}
                    {LEGAL.shortName}. Мы помогаем подобрать и заказать автозапчасти — новые и б/у.
                </p>
            </header>

            

            <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Контакты</h2>
                <dl>
                    <InfoRow label="Город" value="г. Екатеринбург" />
                    <InfoRow label="Адрес" value={LEGAL.legalAddress} />
                    <div className="py-3 border-b border-gray-100">
                        <dt className="text-sm text-gray-500 mb-0.5">Телефон</dt>
                        <dd className="text-gray-900">
                            {phoneFormatted && telHref ? (
                                <a href={telHref} className="text-indigo-600 hover:underline font-medium">
                                    {phoneFormatted}
                                </a>
                            ) : (
                                <span className="text-gray-500">Уточняйте в личном кабинете или у администратора сайта</span>
                            )}
                        </dd>
                    </div>
                    <InfoRow
                        label="Режим работы"
                        value="Пн–Пт: 10:00–18:00 (местное время). В праздничные дни — по объявлению на сайте."
                    />
                    <div className="py-3 border-b border-gray-100">
                        <dt className="text-sm text-gray-500 mb-0.5">Доставка и оплата</dt>
                        <dd className="text-gray-900">
                            <Link to="/delivery" className="text-indigo-600 hover:underline">Условия доставки</Link>
                            {' · '}
                            <Link to="/payment" className="text-indigo-600 hover:underline">Способы оплаты</Link>
                        </dd>
                    </div>
                </dl>
            </section>

            <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Реквизиты</h2>
                <dl>
                    <InfoRow label="Полное наименование" value={LEGAL.fullName} />
                    <InfoRow label="ОГРН" value={LEGAL.ogrn} mono />
                    <InfoRow label="ИНН / КПП" value={`${LEGAL.inn} / ${LEGAL.kpp}`} mono />
                    <InfoRow label="Дата регистрации" value={LEGAL.registeredAt} />
                    <InfoRow label="Юридический адрес" value={LEGAL.legalAddress} />
                    <InfoRow label="Генеральный директор" value={LEGAL.director} />
                 
                </dl>
               
            </section>

           
        </div>
    );
}
