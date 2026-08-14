import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
    fetchAllPaymentMethods,
    fetchOrgPaymentMethods,
    assignPaymentMethod,
    removePaymentMethod,
} from '../../redux/slices/OrganizationSlice';
import { SettingsCard, SettingsSectionHeader, SettingsToggle } from './settingsUi';

const PaymentMethodsSection = ({ orgId }) => {
    const dispatch = useDispatch();
    const token = useSelector((state) => state.auth.token);
    const { allPaymentMethods, orgPaymentMethods, loadingPaymentMethods, paymentMethodsError } = useSelector(
        (state) => state.organization
    );

    const loading = loadingPaymentMethods.paymentMethods || loadingPaymentMethods.paymentMethodAssignments;
    const error = paymentMethodsError;

    useEffect(() => {
        if (token && orgId) {
            dispatch(fetchAllPaymentMethods());
            dispatch(fetchOrgPaymentMethods(orgId));
        }
    }, [dispatch, token, orgId]);

    const handleCheckboxChange = async (methodId, isChecked) => {
        if (!token || !orgId) return;
        try {
            if (isChecked) {
                await dispatch(assignPaymentMethod({ orgId, methodId }));
            } else {
                await dispatch(removePaymentMethod({ orgId, methodId }));
            }
        } catch (err) {
            console.error('Error updating payment method:', err);
        }
    };

    return (
        <SettingsCard>
            <SettingsSectionHeader
                title="Способы оплаты"
                subtitle="Варианты при подтверждении заказа"
                icon={
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                        />
                    </svg>
                }
            />

            {loading ? (
                <div className="animate-pulse space-y-2">
                    <div className="h-14 rounded-sg bg-surface-subtle" />
                    <div className="h-14 rounded-sg bg-surface-subtle" />
                </div>
            ) : error ? (
                <p className="rounded-sg border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">
                    {error}
                </p>
            ) : allPaymentMethods && allPaymentMethods.length > 0 ? (
                <div className="space-y-2">
                    {allPaymentMethods.map((method) => {
                        const isChecked = orgPaymentMethods.some((orgMethod) => orgMethod.id === method.id);
                        return (
                            <SettingsToggle
                                key={method.id}
                                checked={isChecked}
                                disabled={loading}
                                label={method.name}
                                description={method.description}
                                onChange={(e) => handleCheckboxChange(method.id, e.target.checked)}
                            />
                        );
                    })}
                </div>
            ) : (
                <p className="rounded-sg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">
                    Нет доступных способов оплаты
                </p>
            )}
        </SettingsCard>
    );
};

export default PaymentMethodsSection;
