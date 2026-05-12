import MessagesPage from '@/modules/messages/MessagesPage';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Messages - Healing Space Admin',
};

export default function Messages() {
  return <MessagesPage />;
}
