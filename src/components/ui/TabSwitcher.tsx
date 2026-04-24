/* ═══ TabSwitcher — Horizontal tabs with animated underline ═══ */
'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import './TabSwitcher.css';

interface Tab {
  key: string;
  label: string;
  icon?: string;
}

interface TabSwitcherProps {
  tabs: Tab[];
  activeKey: string;
  onChange: (key: string) => void;
}

export default function TabSwitcher({ tabs, activeKey, onChange }: TabSwitcherProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIdx = tabs.findIndex((t) => t.key === activeKey);

  return (
    <div className="ts-container" ref={containerRef}>
      <div className="ts-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`ts-tab ${activeKey === tab.key ? 'ts-tab--active' : ''}`}
            onClick={() => onChange(tab.key)}
          >
            {tab.icon && <span className="ts-tab-icon">{tab.icon}</span>}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      {/* Animated underline */}
      <div className="ts-underline-track">
        <motion.div
          className="ts-underline"
          animate={{
            left: `${(activeIdx / tabs.length) * 100}%`,
            width: `${100 / tabs.length}%`,
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      </div>
    </div>
  );
}
