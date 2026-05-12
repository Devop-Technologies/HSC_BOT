import WahaPage from '@/modules/waha/WahaPage';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WhatsApp Connection - Healing Space Admin',
};

export default function Waha() {
  return <WahaPage />;
}
