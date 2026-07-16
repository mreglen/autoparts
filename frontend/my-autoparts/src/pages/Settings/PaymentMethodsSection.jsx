import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
    fetchAllPaymentMethods,
    fetchOrgPaymentMethods,
    assignPaymentMethod,
    removePaymentMethod,
} from '../../redux/slices/OrganizationSlice';
import { SettingsCard, SettingsSectionHeader } from './settingsUi';

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
        <SettingsCard className="min-h-[400px]">
            <SettingsSectionHeader
                title="Способы оплаты"
                subtitle="Доступные варианты при подтверждении оплаты заказа"
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
                    <div className="h-12 rounded-xl bg-gray-100" />
                    <div className="h-12 rounded-xl bg-gray-100" />
                </div>
            ) : error ? (
                <div className="text-sm text-red-600">Ошибка: {error}</div>
            ) : (
                <div className="space-y-2">
                    {allPaymentMethods && allPaymentMethods.length > 0 ? (
                        allPaymentMethods.map((method) => {
                            const isChecked = orgPaymentMethods.some((orgMethod) => orgMethod.id === method.id);
                            return (
                                <div
                                    key={method.id}
                                    className="flex min-h-[52px] items-center justify-between rounded-xl border border-gray-100 bg-gray-50/60 p-3"
                                >
                                    <div className="min-w-0 truncate pr-2">
                                        <span className="text-sm font-medium text-gray-900">{method.name}</span>
                                        {method.description && (
                                            <span className="ml-2 text-sm text-gray-500">— {method.description}</span>
                                        )}
                                    </div>
                                    <label className="inline-flex shrink-0 cursor-pointer items-center">
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                handleCheckboxChange(method.id, e.target.checked);
                                            }}
                                            className="sr-only peer"
                                            disabled={loading}
                                        />
                                        <div
                                            className={`relative h-6 w-11 rounded-full bg-gray-200 transition-colors peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500/30 peer-checked:bg-indigo-600 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:after:translate-x-full ${loading ? 'opacity-50' : ''}`}
                                        />
                                    </label>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-sm text-gray-500">Нет доступных способов оплаты</p>
                    )}
                </div>
            )}
        </SettingsCard>
    );
};

export default PaymentMethodsSection;
