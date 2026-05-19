/**
 * Demo script — prints a real snapshot from seed data so the Day 3
 * report can show what UI consumers will receive.
 *
 * Run: node -e "require('jiti/register'); require('./tests/three-account/sample-snapshot.ts');"
 */

import { buildThreeAccountSnapshot } from '@/core/finance/threeAccountSnapshot';
import { fullySeededFixture, SAMPLE_BILLS } from './fixtures';

const snapshot = buildThreeAccountSnapshot({
  ledger: fullySeededFixture(),
  monthKey: '2026-05',
  today: 12,
  fixedBills: SAMPLE_BILLS,
  dailySpendingLimit: 9_800_000,
  carryOver: 800_000,
  monthlySavingsTarget: 1_700_000,
  monthlyIncome: 19_111_550,
});

console.log(JSON.stringify(snapshot, null, 2));
