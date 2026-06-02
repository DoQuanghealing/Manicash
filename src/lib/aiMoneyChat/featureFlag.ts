export function isAiMoneyChatEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_AI_MONEY_CHAT_ENABLED === 'true' ||
    process.env.NODE_ENV === 'development'
  );
}

