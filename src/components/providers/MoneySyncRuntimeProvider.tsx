'use client';

import type { ReactNode } from 'react';
import { useMoneySyncRuntime } from '@/hooks/useMoneySyncRuntime';

export function MoneySyncRuntimeProvider({ children }: { children: ReactNode }) {
  useMoneySyncRuntime();

  return <>{children}</>;
}
