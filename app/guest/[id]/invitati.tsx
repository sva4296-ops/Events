import { GuestDashboard } from '@/components/GuestDashboard';
import { VenueBookings } from '@/components/venue/VenueBookings';
import { useGuestEvent } from '@/hooks/useGuestEvent';

export default function InvitatiScreen() {
  const { id, event } = useGuestEvent();
  // A venue night's guests are its bookings.
  if (event?.type === 'venue') return <VenueBookings id={id} embedded />;
  return <GuestDashboard id={id} embedded />;
}
