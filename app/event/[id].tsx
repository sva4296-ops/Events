import { useLocalSearchParams } from "expo-router";

import { GuestDashboard } from "@/components/GuestDashboard";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GuestDashboard id={id} />;
}
