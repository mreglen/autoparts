import { Ionicons } from "@expo/vector-icons";

import { EmptyState, Screen } from "../components/ui";

interface PlaceholderScreenProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  description?: string;
}

export function PlaceholderScreen({
  title,
  icon,
  description,
}: PlaceholderScreenProps) {
  return (
    <Screen className="items-center justify-center">
      <EmptyState
        icon={icon}
        title={title}
        message={description ?? "Раздел появится на следующих этапах каркаса."}
      />
    </Screen>
  );
}
