import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import {
  fetchGarageVehicles,
  fetchMyClientOrgs,
  type GarageVehicle,
  type MyClientOrg,
} from "../api/clientAccount";
import { describeError } from "../api/errors";
import {
  FadeSlideIn,
  ListRow,
  Screen,
  SearchField,
  SkeletonRows,
  StaleDataBadge,
  useToast,
} from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";

interface GarageRow extends GarageVehicle {
  orgNames?: string[];
}

function vehicleTitle(v: GarageVehicle): string {
  return [v.make, v.model].filter(Boolean).join(" ") || "Авто";
}

function vehicleSubtitle(v: GarageVehicle): string {
  const parts: string[] = [];
  if (v.plate) parts.push(v.plate);
  if (v.year) parts.push(String(v.year));
  if (v.mileage_km != null) parts.push(`${v.mileage_km} км`);
  return parts.join(" · ");
}

/** Одна карточка на уникальный VIN; без VIN — на каждую запись. */
function dedupeVehicles(rows: GarageRow[]): GarageRow[] {
  const groups = new Map<string, GarageRow[]>();
  for (const row of rows) {
    const key = row.vin?.trim().toUpperCase() || `id:${row.id}`;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.values()].map((group) => {
    const primary = group[0];
    const orgNames = [
      ...new Set(
        group
          .map((g) => g.orgNames?.[0])
          .filter((n): n is string => Boolean(n)),
      ),
    ];
    return orgNames.length > 1 ? { ...primary, orgNames } : primary;
  });
}

export function ClientGarageScreen() {
  const { colors } = useTheme();
  const { show } = useToast();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [rows, setRows] = useState<GarageRow[]>([]);
  const [orgs, setOrgs] = useState<MyClientOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const orgsResult = await fetchMyClientOrgs();
        const list = orgsResult.data ?? [];
        setOrgs(list);
        const nameById = new Map(
          list.map((o) => [o.organization_id, o.organization_name ?? null]),
        );
        const results = await Promise.all(
          list.map((o) => fetchGarageVehicles(o.organization_id)),
        );
        const merged: GarageRow[] = [];
        let oldestFetch: number | null = null;
        let anyStale = false;
        results.forEach((r) => {
          if (r.stale) anyStale = true;
          if (oldestFetch === null || r.fetchedAt < oldestFetch)
            oldestFetch = r.fetchedAt;
          for (const v of r.data ?? []) {
            const orgName = nameById.get(v.organization_id);
            merged.push({ ...v, orgNames: orgName ? [orgName] : [] });
          }
        });
        merged.sort((a, b) => b.id - a.id);
        setRows(dedupeVehicles(merged));
        setStale(anyStale ? oldestFetch : null);
      } catch (e) {
        show(describeError(e), "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [show],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- первичная загрузка
    void load();
  }, [load]);

  if (loading) {
    return (
      <Screen scroll={false}>
        <SkeletonRows count={4} />
      </Screen>
    );
  }

  const multiOrg = orgs.length > 1;
  const q = query.trim().toLowerCase();
  const visible = q
    ? rows.filter((v) =>
        [v.make, v.model, v.plate, v.vin]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
    : rows;

  return (
    <Screen onRefresh={() => void load(true)} refreshing={refreshing}>
      {stale != null ? <StaleDataBadge fetchedAt={stale} /> : null}
      {rows.length > 0 ? (
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Марка, модель, госномер, VIN"
          className="mb-2"
        />
      ) : null}
      {visible.length === 0 ? (
        <View className="items-center pt-16">
          <Ionicons
            name="car-outline"
            size={40}
            color={colors.inkFaint}
            style={{ marginBottom: 8 }}
          />
          <Text className="text-base font-medium" style={{ color: colors.ink }}>
            {rows.length === 0 ? "Автомобили не добавлены" : "Ничего не найдено"}
          </Text>
          {rows.length === 0 ? (
            <Text
              className="mt-1 text-center text-sm"
              style={{ color: colors.inkMuted }}
            >
              Добавьте авто — подберём марку и модель по VIN или госномеру.
            </Text>
          ) : null}
        </View>
      ) : (
        visible.map((v, i) => (
          <FadeSlideIn
            key={`${v.organization_id}-${v.id}`}
            index={i}
            style={{ marginTop: 8 }}
          >
            <ListRow
              title={vehicleTitle(v)}
              subtitle={vehicleSubtitle(v)}
              right={
                multiOrg && v.orgNames?.length
                  ? v.orgNames.join(", ")
                  : undefined
              }
              onPress={() =>
                navigation.navigate("ClientVehicle", {
                  vehicle: v,
                  orgName: v.orgNames?.[0] ?? null,
                })
              }
            />
          </FadeSlideIn>
        ))
      )}

      <Pressable
        onPress={() => navigation.navigate("ClientVehicleForm", {})}
        className="mt-6 flex-row items-center justify-center gap-2 rounded-xl py-3.5"
        style={{ backgroundColor: colors.brand }}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text className="text-base font-semibold text-white">
          Добавить автомобиль
        </Text>
      </Pressable>
    </Screen>
  );
}
