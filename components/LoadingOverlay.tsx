'use client';

import { C } from '@/lib/colors';

interface Props {
  show: boolean;
  message?: string;
}

export default function LoadingOverlay({ show, message = '処理中...' }: Props) {
  if (!show) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '36px 56px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          width: 48, height: 48,
          border: `4px solid ${C.border}`,
          borderTop: `4px solid ${C.gold}`,
          borderRadius: '50%',
          animation: 'overlay-spin 0.75s linear infinite',
        }} />
        <style>{`@keyframes overlay-spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ color: C.text, fontSize: 16, fontWeight: 600 }}>{message}</span>
      </div>
    </div>
  );
}
