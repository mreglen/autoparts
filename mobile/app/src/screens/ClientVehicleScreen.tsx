import { useState } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { deleteGarageVehicle } from "../api/clientAccount";
import { describeError } from "../api/errors";
import { Button, Card, ConfirmDialog, Screen, useToast } from "../components/ui";
import { invalidateEntities } from "../offline";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";
import { AppText as Text } from "../components/ui/AppText";

type Props = NativeStackScreenProps<RootStackParamList, "ClientVehicle">;

function Field({ label, value }: { label: string; value?: string | null }) {
  const { colors } = useTheme();
  if (!value) return null;
  return (
    <View className="flex-row justify-between py-2.5">
      <Text className="text-sm" style={{ color: colors.inkMuted }}>
        {label}
      </Text>
      <Text
        className="ml-4 flex-1 text-right text-sm font-medium"
        style={{ color: colors.ink }}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

export function ClientVehicleScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { show } = useToast();
  const { vehicle, orgName } = route.params;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const title =
    [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Авто";

  const doDelete = async () => {
    setDeleting(true);
    try {
      await deleteGarageVehicle(vehicle.id, vehicle.organization_id);
      await invalidateEntities(["garage-vehicles"]);
      show("Автомобиль удалён", "success");
      navigation.goBack();
    } catch (e) {
      show(describeError(e), "error");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen>
      <Card className="mb-4 flex-row items-center">
        <Ionicons
          name="car-sport-outline"
          size={22}
          color={colors.brand}
          style={{ marginRight: 10 }}
        />
        <View className="min-w-0 flex-1">
          <Text
            className="text-base font-semibold"
            style={{ color: colors.ink }}
          >
            {title}
          </Text>
          {orgName ? (
            <Text className="text-xs" style={{ color: colors.inkMuted }}>
              {orgName}
            </Text>
          ) : null}
        </View>
      </Card>

      <Card>
        <Field label="VIN" value={vehicle.vin} />
        <Field label="Госномер" value={vehicle.plate} />
        <Field label="Год" value={vehicle.year ? String(vehicle.year) : null} />
        <Field label="Цвет" value={vehicle.color} />
        <Field
          label="Пробег"
          value={vehicle.mileage_km != null ? `${vehicle.mileage_km} км` : null}
        />
        <Field label="Заметки" value={vehicle.notes} />
      </Card>

      <View className="mt-6 gap-2">
        <Button
          title="Редактировать"
          onPress={() =>
            navigation.navigate("ClientVehicleForm", {
              vehicle,
              organizationId: vehicle.organization_id,
            })
          }
        />
        <Button
          title={deleting ? "Удаление…" : "Удалить автомобиль"}
          variant="danger"
          loading={deleting}
          onPress={() => setConfirmDelete(true)}
        />
      </View>

      <ConfirmDialog
        visible={confirmDelete}
        title="Удалить автомобиль?"
        message="Если к авто привязаны заказ-наряды или записи, удаление будет отклонено."
        confirmLabel="Удалить"
        destructive
        onConfirm={() => void doDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}
