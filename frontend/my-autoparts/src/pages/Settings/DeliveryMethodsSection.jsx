import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchAllDeliveryMethods, fetchOrgDeliveryMethods, assignDeliveryMethod, removeDeliveryMethod } from '../../redux/slices/OrganizationSlice';
import { SettingsCard, SettingsSectionHeader, SettingsToggle } from './settingsUi';

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
        <SettingsCard>
            <SettingsSectionHeader
                title="Способы доставки"
                subtitle="Что увидит покупатель при оформлении"
                icon={
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h1m8-3h5l2-2v-5h-6" />
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
            ) : allDeliveryMethods && allDeliveryMethods.length > 0 ? (
                <div className="space-y-2">
                    {allDeliveryMethods.map((method) => {
                        const isChecked = orgDeliveryMethods.some((orgMethod) => orgMethod.id === method.id);
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
                    Нет доступных способов доставки
                </p>
            )}
        </SettingsCard>
    );
};

export default DeliveryMethodsSection;
