/**
 * Phase 1 three-account test suite runner.
 *
 * Imports each test file (which registers tests at top-level via describe/it)
 * and prints summary at the end.
 *
 * Run with: npm run test:three-account
 */

import './feature-flags.test';
import './account-roles.test';
import './selectors.test';
import './safe-to-spend.test';
import './snapshot.test';
import './wiring.test';
import './domain-adapter.test';
import './migration.test';
import { summary } from './harness';

summary();
