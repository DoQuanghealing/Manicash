export function isAiMoneyChatEnabled(): boolean {
  // Bật MẶC ĐỊNH. Chỉ tắt khi đặt rõ NEXT_PUBLIC_AI_MONEY_CHAT_ENABLED=false.
  // (Trước đây mặc định tắt ở prod → "Chat đang tắt" trên web đã deploy.)
  return process.env.NEXT_PUBLIC_AI_MONEY_CHAT_ENABLED !== 'false';
}

