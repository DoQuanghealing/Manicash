import type { Metadata } from 'next';
import AiMoneyChatContent from './_components/AiMoneyChatContent';
import { isAiMoneyChatEnabled } from '@/lib/aiMoneyChat/featureFlag';

export const metadata: Metadata = {
  title: 'AI Money Chat - ManiCash',
  description: 'Nhap giao dich bang ngon ngu tu nhien voi ManiCash AI Money Chat.',
};

export default function AiMoneyChatPage() {
  return <AiMoneyChatContent enabled={isAiMoneyChatEnabled()} />;
}

