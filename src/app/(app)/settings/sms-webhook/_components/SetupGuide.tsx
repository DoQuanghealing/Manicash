/* ═══ SetupGuide — Tab switcher Android/iOS ═══ */
'use client';

import { useState } from 'react';
import AndroidSetup from './AndroidSetup';
import IOSSetup from './IOSSetup';

type Platform = 'android' | 'ios';

export default function SetupGuide() {
  const [platform, setPlatform] = useState<Platform>('android');

  return (
    <section className="sw-card">
      <h2 className="sw-card-title">📱 Hướng dẫn cài đặt</h2>

      <div className="sw-tabs">
        <button
          className={`sw-tab ${platform === 'android' ? 'active' : ''}`}
          onClick={() => setPlatform('android')}
          type="button"
        >
          🤖 Android (MacroDroid)
        </button>
        <button
          className={`sw-tab ${platform === 'ios' ? 'active' : ''}`}
          onClick={() => setPlatform('ios')}
          type="button"
        >
          🍎 iOS (Shortcut)
        </button>
      </div>

      {platform === 'android' ? <AndroidSetup /> : <IOSSetup />}
    </section>
  );
}
