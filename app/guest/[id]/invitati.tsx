import { GuestDashboard } from '@/components/GuestDashboard';
import { useGuestEvent } from '@/hooks/useGuestEvent';

export default function InvitatiScreen() {
  const { id } = useGuestEvent();
  return <GuestDashboard id={id} embedded />;
}
