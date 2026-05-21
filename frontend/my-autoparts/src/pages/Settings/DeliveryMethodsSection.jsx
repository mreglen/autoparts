import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchAllDeliveryMethods, fetchOrgDeliveryMethods, assignDeliveryMethod, removeDeliveryMethod } from '../../redux/slices/OrganizationSlice';
import { SettingsCard, SettingsSectionHeader } from './settingsUi';

const DeliveryMethodsSection = ({ orgId }) => {
    const dispatch = useDispatch();
    const token = useSelector((state) => state.auth.token);
    const { allDeliveryMethods, orgDeliveryMethods, loadingDeliveryMethods, deliveryMethodsError } = useSelector(
        (state) => state.organization
    );

    const loading = loadingDeliveryMethods.deliveryMethods || loadingDeliveryMethods.deliveryMethodAssignments;
    const error = deliveryMethodsError;

    useEffect(() => {
        if (token && orgId) {
            dispatch(fetchAllDeliveryMethods());
            dispatch(fetchOrgDeliveryMethods(orgId));
        }
    }, [dispatch, token, orgId]);

    const handleCheckboxChange = async (methodId, isChecked) => {
        if (!token || !orgId) return;
        try {
            if (isChecked) {
                await dispatch(assignDeliveryMethod({ orgId, methodId }));
            } else {
                await dispatch(removeDeliveryMethod({ orgId, methodId }));
            }
        } catch (err) {
            console.error('Error updating delivery method:', err);
        }
    };

    return (
        <SettingsCard className="min-h-[400px]">
            <SettingsSectionHeader
                title="Способы доставки"
                subtitle="Доступные варианты для покупателей"
                icon={
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h1m8-3h5l2-2v-5h-6" />
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
                    {allDeliveryMethods && allDeliveryMethods.length > 0 ? (
                        allDeliveryMethods.map((method) => {
                            const isChecked = orgDeliveryMethods.some((orgMethod) => orgMethod.id === method.id);
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
                        <p className="text-sm text-gray-500">Нет доступных способов доставки</p>
                    )}
                </div>
            )}
        </SettingsCard>
    );
};

export default DeliveryMethodsSection;
