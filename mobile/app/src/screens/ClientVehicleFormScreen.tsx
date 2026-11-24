import { useEffect, useState } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import {
  createGarageVehicle,
  decodeGarageVehicle,
  fetchMyClientOrgs,
  updateGarageVehicle,
  type GarageVehicle,
  type MyClientOrg,
  type VehicleDecodeCandidate,
  type VehicleDecodeResult,
} from "../api/clientAccount";
import { describeError } from "../api/errors";
import {
  Button,
  Chip,
  ListRow,
  Screen,
  useToast,
} from "../components/ui";
import { inputChrome } from "../components/ui/chrome";
import type { RootStackParamList } from "../navigation/types";
import { invalidateEntities } from "../offline";
import {
  VIN_INPUT_MAX_LENGTH,
  candidateLabel,
  detectVehicleLookupKind,
  mapCandidateToCreatePayload,
  mapCandidateToGarageForm,
  normalizeGarageVinOrNull,
  normalizePlate,
  normalizeVinForLookupOrNull,
  sanitizeVinInput,
  type GarageVehicleFormFields,
  type VehicleLookupKind,
} from "../utils/vehicleLookup";
import { useTheme } from "../theme/useTheme";
import { AppText as Text, AppTextInput as TextInput } from "../components/ui/AppText";

type Props = NativeStackScreenProps<RootStackParamList, "ClientVehicleForm">;

const EMPTY_FIELDS: GarageVehicleFormFields = {
  vin: "",
  make: "",
  model: "",
  year: "",
  color: "",
  plate: "",
  notes: "",
};

function fieldsFromVehicle(v: GarageVehicle): GarageVehicleFormFields {
  return {
    vin: v.vin ?? "",
    make: v.make ?? "",
    model: v.model ?? "",
    year: v.year ? String(v.year) : "",
    color: v.color ?? "",
    plate: v.plate ?? "",
    notes: v.notes ?? "",
  };
}

function normalizedLookupInput(
  kind: VehicleLookupKind,
  raw: string,
): string | null {
  if (kind === "vin") return normalizeVinForLookupOrNull(raw);
  if (kind === "plate") {
    const plate = normalizePlate(raw);
    return plate || null;
  }
  const frame = raw.toUpperCase().replace(/\s+/g, "");
  return frame.length >= 6 ? frame : null;
}

function noticeFromDecode(result: VehicleDecodeResult): string {
  if (result.message) return result.message;
  if (result.reason === "not_found") {
    return "Авто не найдено в каталоге — заполните данные вручную.";
  }
  if (result.reason === "temporarily_unavailable") {
    return "Каталог временно недоступен — заполните данные вручную.";
  }
  return "Не удалось определить автомобиль — заполните данные вручную.";
}

export function ClientVehicleFormScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { show } = useToast();
  const editing = route.params?.vehicle;
  const isEdit = Boolean(editing);

  const [orgs, setOrgs] = useState<MyClientOrg[]>([]);
  const [orgId, setOrgId] = useState<string>(
    () => route.params?.organizationId ?? "",
  );
  const [fields, setFields] = useState<GarageVehicleFormFields>(() =>
    editing ? fieldsFromVehicle(editing) : EMPTY_FIELDS,
  );

  const [lookupInput, setLookupInput] = useState("");
  const [lookupKind, setLookupKind] = useState<VehicleLookupKind | null>(null);
  const [candidates, setCandidates] = useState<VehicleDecodeCandidate[]>([]);
  const [candidate, setCandidate] = useState<VehicleDecodeCandidate | null>(
    null,
  );
  const [lookupBusy, setLookupBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isEdit) return;
    let cancelled = false;
    void fetchMyClientOrgs()
      .then((r) => {
        if (cancelled) return;
        const list = r.data ?? [];
        setOrgs(list);
        setOrgId((prev) => prev || list[0]?.organization_id || "");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isEdit]);

  const setField = (key: keyof GarageVehicleFormFields) => (value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const applyCandidate = (
    c: VehicleDecodeCandidate,
    ctx: { vin?: string | null; plate?: string | null },
  ) => {
    setCandidate(c);
    setFields(mapCandidateToGarageForm(c, ctx.vin ?? "", ctx.plate ?? ""));
    setCandidates([]);
    setNotice("");
  };

  const runLookup = async () => {
    setError("");
    setNotice("");
    setCandidates([]);
    setCandidate(null);
    const kind = detectVehicleLookupKind(lookupInput);
    if (!kind) {
      setNotice(
        "Введите VIN, госномер или frame-номер — определим марку и модель автоматически.",
      );
      return;
    }
    const input = normalizedLookupInput(kind, lookupInput);
    if (!input) {
      setNotice("Введённые данные похожи на номер, но неполные.");
      return;
    }
    setLookupKind(kind);
    setLookupBusy(true);
    try {
      const result = await decodeGarageVehicle(kind, input);
      const list = result.candidates ?? [];
      if (!result.ok || list.length === 0) {
        setNotice(noticeFromDecode(result));
        return;
      }
      const ctx = {
        vin:
          result.vin ?? (kind === "vin" ? sanitizeVinInput(lookupInput) : null),
        plate:
          result.plate ??
          (kind === "plate" ? normalizePlate(lookupInput) : null),
      };
      if (list.length === 1) {
        applyCandidate(list[0], ctx);
      } else {
        setCandidates(list);
        setNotice("Найдено несколько вариантов — выберите свой.");
      }
    } catch (e) {
      setNotice(describeError(e));
    } finally {
      setLookupBusy(false);
    }
  };

  const submit = async () => {
    setError("");
    const make = fields.make.trim();
    if (!make) {
      setError("Укажите марку автомобиля");
      return;
    }
    const yearNum = fields.year.trim() ? Number(fields.year) : null;
    if (
      yearNum != null &&
      (yearNum < 1900 || yearNum > 2100 || Number.isNaN(yearNum))
    ) {
      setError("Год — от 1900 до 2100");
      return;
    }
    const vinNorm = fields.vin.trim()
      ? (normalizeGarageVinOrNull(fields.vin) ??
        fields.vin.trim().toUpperCase())
      : null;
    if (fields.vin.trim() && !vinNorm) {
      setError("VIN должен содержать 11–17 символов (буквы и цифры)");
      return;
    }

    setBusy(true);
    try {
      if (editing) {
        await updateGarageVehicle(editing.id, editing.organization_id, {
          vin: vinNorm,
          make,
          model: fields.model.trim() || null,
          year: yearNum,
          color: fields.color.trim() || null,
          plate: fields.plate.trim() || null,
          notes: fields.notes.trim() || null,
        });
      } else {
        if (!orgId) {
          setError("Не удалось определить автосервис");
          setBusy(false);
          return;
        }
        const payload = mapCandidateToCreatePayload(
          candidate,
          {
            ...fields,
            vin: vinNorm ?? "",
            make,
          },
          {
            fromPlate: lookupKind === "plate",
            fromFrame: lookupKind === "frame",
            frameQuery: lookupKind === "frame" ? lookupInput.trim() : "",
          },
        );
        await createGarageVehicle(orgId, payload);
      }
      await invalidateEntities(["garage-vehicles"]);
      show(editing ? "Автомобиль обновлён" : "Автомобиль добавлен", "success");
      navigation.goBack();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = inputChrome(colors);

  const field = (
    key: keyof GarageVehicleFormFields,
    placeholder: string,
    opts: {
      keyboardType?: "default" | "number-pad" | "numbers-and-punctuation";
      autoCapitalize?: "none" | "sentences" | "characters";
      maxLength?: number;
      multiline?: boolean;
    } = {},
  ) => (
    <TextInput
      key={key}
      value={fields[key]}
      onChangeText={setField(key)}
      placeholder={placeholder}
      placeholderTextColor={colors.inkFaint}
      keyboardType={opts.keyboardType ?? "default"}
      autoCapitalize={opts.autoCapitalize ?? "sentences"}
      autoCorrect={false}
      maxLength={opts.maxLength}
      multiline={opts.multiline}
      className="rounded-xl px-4 py-3 text-base"
      style={[
        inputStyle,
        opts.multiline ? { minHeight: 72, textAlignVertical: "top" } : null,
      ]}
    />
  );

  return (
    <Screen>
      <View className="gap-4">
        {!isEdit ? (
          <>
            <View>
              <Text
                className="mb-1.5 text-xs font-medium"
                style={{ color: colors.inkMuted }}
              >
                Подбор по VIN, госномеру или frame
              </Text>
              <View className="flex-row gap-2">
                <TextInput
                  value={lookupInput}
                  onChangeText={(t) => {
                    setLookupInput(t);
                    setCandidates([]);
                    setNotice("");
                  }}
                  placeholder="Например: WBA… или А123БВ77"
                  placeholderTextColor={colors.inkFaint}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={VIN_INPUT_MAX_LENGTH}
                  className="flex-1 rounded-xl px-4 py-3 text-base"
                  style={inputStyle}
                />
                <Button
                  title="Найти"
                  compact
                  loading={lookupBusy}
                  className="justify-center px-4"
                  onPress={() => void runLookup()}
                />
              </View>
            </View>

            {notice ? (
              <Text className="text-sm" style={{ color: colors.warning }}>
                {notice}
              </Text>
            ) : null}

            {candidates.length > 0 ? (
              <View className="gap-2">
                {candidates.map((c, i) => (
                  <ListRow
                    key={`${c.catalog ?? ""}-${c.vehicle_id ?? i}`}
                    title={candidateLabel(c)}
                    subtitle={
                      [c.body, c.transmission].filter(Boolean).join(" · ") ||
                      undefined
                    }
                    onPress={() =>
                      applyCandidate(c, {
                        vin:
                          lookupKind === "vin"
                            ? sanitizeVinInput(lookupInput)
                            : undefined,
                        plate:
                          lookupKind === "plate"
                            ? normalizePlate(lookupInput)
                            : undefined,
                      })
                    }
                  />
                ))}
              </View>
            ) : null}

            {orgs.length > 1 ? (
              <View>
                <Text
                  className="mb-1.5 text-xs font-medium"
                  style={{ color: colors.inkMuted }}
                >
                  Автосервис
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {orgs.map((o) => (
                    <Chip
                      key={o.organization_id}
                      label={o.organization_name ?? o.organization_id}
                      selected={o.organization_id === orgId}
                      onPress={() => setOrgId(o.organization_id)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        <View className="flex-row gap-3">
          <View className="flex-[2]">
            {field("make", "Марка *", { maxLength: 80 })}
          </View>
          <View className="flex-[3]">
            {field("model", "Модель", { maxLength: 80 })}
          </View>
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1">
            {field("year", "Год", {
              keyboardType: "number-pad",
              maxLength: 4,
            })}
          </View>
          <View className="flex-[2]">
            {field("color", "Цвет", { maxLength: 40 })}
          </View>
        </View>
        {field("plate", "Госномер", {
          autoCapitalize: "characters",
          maxLength: 20,
        })}
        {field("vin", "VIN / frame", {
          autoCapitalize: "characters",
          maxLength: VIN_INPUT_MAX_LENGTH,
        })}
        {field("notes", "Заметки", { multiline: true })}

        {error ? (
          <Text className="text-sm" style={{ color: colors.danger }}>
            {error}
          </Text>
        ) : null}

        <Button
          title={
            busy
              ? "Сохранение…"
              : editing
                ? "Сохранить изменения"
                : "Добавить автомобиль"
          }
          loading={busy}
          onPress={() => void submit()}
        />
      </View>
    </Screen>
  );
}
