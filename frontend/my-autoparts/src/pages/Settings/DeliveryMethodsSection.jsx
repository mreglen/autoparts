import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchAllDeliveryMethods, fetchOrgDeliveryMethods, assignDeliveryMethod, removeDeliveryMethod } from '../../redux/slices/OrganizationSlice';
import { Card, EmptyState, Skeleton } from '../../components/UI';
import { SettingsToggle } from './settingsUi';

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
        <Card>
            <h3 className="text-sm font-semibold text-gray-900">Способы доставки</h3>
            <p className="mt-0.5 mb-4 text-sm text-gray-500">Что увидит покупатель при оформлении</p>

            {loading ? (
                <div className="space-y-2">
                    <Skeleton className="h-14 w-full rounded-xl" />
                    <Skeleton className="h-14 w-full rounded-xl" />
                </div>
            ) : error ? (
                <EmptyState illustration="error" title="Не удалось загрузить" description={error} />
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
                <p className="py-4 text-sm text-gray-500">Нет доступных способов доставки</p>
            )}
        </Card>
    );
};

export default DeliveryMethodsSection;
