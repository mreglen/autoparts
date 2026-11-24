import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { deleteGarageVehicle } from "../api/clientAccount";
import { describeError } from "../api/errors";
import { ConfirmDialog, Screen, useToast } from "../components/ui";
import { invalidateEntities } from "../offline";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";

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
      <View
        className="mb-4 flex-row items-center rounded-xl px-4 py-3"
        style={{ backgroundColor: colors.surfaceSubtle }}
      >
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
      </View>

      <View
        className="rounded-xl px-4"
        style={{ backgroundColor: colors.surfaceSubtle }}
      >
        <Field label="VIN" value={vehicle.vin} />
        <Field label="Госномер" value={vehicle.plate} />
        <Field label="Год" value={vehicle.year ? String(vehicle.year) : null} />
        <Field label="Цвет" value={vehicle.color} />
        <Field
          label="Пробег"
          value={vehicle.mileage_km != null ? `${vehicle.mileage_km} км` : null}
        />
        <Field label="Заметки" value={vehicle.notes} />
      </View>

      <View className="mt-6 gap-2">
        <Pressable
          onPress={() =>
            navigation.navigate("ClientVehicleForm", {
              vehicle,
              organizationId: vehicle.organization_id,
            })
          }
          className="items-center rounded-xl py-3.5"
          style={{ backgroundColor: colors.brand }}
        >
          <Text className="text-base font-semibold text-white">
            Редактировать
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setConfirmDelete(true)}
          disabled={deleting}
          className="items-center rounded-xl py-3"
          style={{
            backgroundColor: colors.surfaceSubtle,
            opacity: deleting ? 0.6 : 1,
          }}
        >
          <Text
            className="text-base font-medium"
            style={{ color: colors.danger }}
          >
            {deleting ? "Удаление…" : "Удалить автомобиль"}
          </Text>
        </Pressable>
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
