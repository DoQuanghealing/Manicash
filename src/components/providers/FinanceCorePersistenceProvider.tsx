'use client';

import type { ReactNode } from 'react';
import { useFinanceCorePersistence } from '@/hooks/useFinanceCorePersistence';

export function FinanceCorePersistenceProvider({ children }: { children: ReactNode }) {
  useFinanceCorePersistence();

  return <>{children}</>;
}
