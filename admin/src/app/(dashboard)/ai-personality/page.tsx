import AiPersonalityPage from '@/modules/aiPersonality/AiPersonalityPage';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Personality - Healing Space Admin',
};

export default function AiPersonality() {
  return <AiPersonalityPage />;
}
