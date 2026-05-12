import GreetingsPage from '@/modules/greetings/GreetingsPage';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Greetings - Healing Space Admin',
};

export default function Greetings() {
  return <GreetingsPage />;
}
