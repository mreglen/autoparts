import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPublicSiteConfig } from '../../redux/slices/PublicInfoSlice';
import { buildAboutSeo, PageSeoHelmet } from '../../utils/pageSeo';
import YandexWebmasterCounter from '../../components/Seo/YandexWebmasterCounter';
import { Card, PageHeader } from '../../components/UI';

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
        <div className="border-b border-line py-3 last:border-0">
            <dt className="mb-0.5 text-sm text-ink-muted">{label}</dt>
            <dd className={`text-ink ${mono ? 'font-mono text-sm' : ''}`}>{value}</dd>
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

    const seo = buildAboutSeo();

    return (
        <div className="mx-auto max-w-4xl">
            <PageSeoHelmet seo={seo} />
            <PageHeader
                title="О компании"
                subtitle={
                    <>
                        Интернет-магазин <strong className="text-ink">«Свой Гараж»</strong> работает под управлением{' '}
                        {LEGAL.shortName}. Мы помогаем подобрать и заказать автозапчасти — новые и б/у.
                    </>
                }
            />

            <Card className="mb-6" padding="md">
                <h2 className="mb-4 text-lg font-semibold text-ink">Контакты</h2>
                <dl>
                    <InfoRow label="Город" value="г. Екатеринбург" />
                    <InfoRow label="Адрес" value={LEGAL.legalAddress} />
                    <div className="border-b border-line py-3">
                        <dt className="mb-0.5 text-sm text-ink-muted">Телефон</dt>
                        <dd className="text-ink">
                            {phoneFormatted && telHref ? (
                                <a href={telHref} className="font-medium text-brand-600 hover:underline">
                                    {phoneFormatted}
                                </a>
                            ) : (
                                <span className="text-ink-muted">Уточняйте в личном кабинете или у администратора сайта</span>
                            )}
                        </dd>
                    </div>
                    <InfoRow
                        label="Режим работы"
                        value="Пн–Пт: 10:00–18:00 (местное время). В праздничные дни — по объявлению на сайте."
                    />
                    <div className="border-b border-line py-3">
                        <dt className="mb-0.5 text-sm text-ink-muted">Доставка и оплата</dt>
                        <dd className="text-ink">
                            <Link to="/delivery" className="text-brand-600 hover:underline">Условия доставки</Link>
                            {' · '}
                            <Link to="/payment" className="text-brand-600 hover:underline">Способы оплаты</Link>
                        </dd>
                    </div>
                    <div className="border-b border-line py-3 last:border-0">
                        <dt className="mb-0.5 text-sm text-ink-muted">Документы</dt>
                        <dd className="text-ink">
                            <Link to="/privacy" className="text-brand-600 hover:underline">
                                Политика конфиденциальности
                            </Link>
                            {' · '}
                            <Link to="/personal-data-consent" className="text-brand-600 hover:underline">
                                Согласие на обработку персональных данных
                            </Link>
                            {' · '}
                            <Link to="/offer" className="text-brand-600 hover:underline">
                                Публичная оферта
                            </Link>
                            {' · '}
                            <Link to="/cookie-policy" className="text-brand-600 hover:underline">
                                Политика обработки cookie
                            </Link>
                        </dd>
                    </div>
                </dl>
            </Card>

            <Card className="mb-6" padding="md">
                <h2 className="mb-4 text-lg font-semibold text-ink">Реквизиты</h2>
                <dl>
                    <InfoRow label="Полное наименование" value={LEGAL.fullName} />
                    <InfoRow label="ОГРН" value={LEGAL.ogrn} mono />
                    <InfoRow label="ИНН / КПП" value={`${LEGAL.inn} / ${LEGAL.kpp}`} mono />
                    <InfoRow label="Дата регистрации" value={LEGAL.registeredAt} />
                    <InfoRow label="Юридический адрес" value={LEGAL.legalAddress} />
                    <InfoRow label="Генеральный директор" value={LEGAL.director} />
                </dl>
            </Card>

            <YandexWebmasterCounter />
        </div>
    );
}
