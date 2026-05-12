import ClientLocationsPage from '@/modules/clientLocations/ClientLocationsPage';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Client Locations - Healing Space Admin',
};

export default function ClientLocations() {
  return <ClientLocationsPage />;
}
