import { useLocalSearchParams } from 'expo-router';

import { VenueBookings } from '@/components/venue/VenueBookings';

export default function VenueBookingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <VenueBookings id={id} />;
}
