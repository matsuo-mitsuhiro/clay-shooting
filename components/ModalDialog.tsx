'use client';

import { useEffect, useState } from 'react';
import { C } from '@/lib/colors';

const overlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
};

const panelStyle: React.CSSProperties = {
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
  padding: '24px 28px', maxWidth: 460, width: '90%',
};

const msgStyle: React.CSSProperties = {
  margin: '0 0 24px', fontSize: 15, color: C.text, whiteSpace: 'pre-wrap', lineHeight: 1.6,
};

const cancelBtnStyle: React.CSSProperties = {
  background: C.surface2, color: C.text, border: `1px solid ${C.border}`,
  borderRadius: 5, padding: '8px 20px', fontSize: 15, cursor: 'pointer',
};

function okBtnStyle(color?: string): React.CSSProperties {
  return {
    background: color ?? C.gold, color: '#fff', border: 'none',
    borderRadius: 5, padding: '8px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
  };
}

/** 確認モーダル（OK / キャンセル） */
export function ConfirmModal({
  message,
  onOk,
  onCancel,
  okLabel = 'OK',
  cancelLabel = 'キャンセル',
  okColor,
}: {
  message: string;
  onOk: () => void;
  onCancel: () => void;
  okLabel?: string;
  cancelLabel?: string;
  okColor?: string;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div style={overlayStyle}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>
        <p style={msgStyle}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={cancelBtnStyle}>{cancelLabel}</button>
          <button onClick={onOk} style={okBtnStyle(okColor)}>{okLabel}</button>
        </div>
      </div>
    </div>
  );
}

/** アラートモーダル（OKのみ） */
export function AlertModal({
  message,
  onClose,
  okLabel = 'OK',
}: {
  message: string;
  onClose: () => void;
  okLabel?: string;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div style={overlayStyle}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>
        <p style={msgStyle}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={okBtnStyle()}>{okLabel}</button>
        </div>
      </div>
    </div>
  );
}

/** プロンプトモーダル（テキスト入力 + OK / キャンセル） */
export function PromptModal({
  message,
  onOk,
  onCancel,
  okLabel = 'OK',
  cancelLabel = 'キャンセル',
  okColor,
  placeholder,
}: {
  message: string;
  onOk: (value: string) => void;
  onCancel: () => void;
  okLabel?: string;
  cancelLabel?: string;
  okColor?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div style={overlayStyle}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>
        <p style={{ ...msgStyle, marginBottom: 16 }}>{message}</p>
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={placeholder}
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') onOk(value); }}
          style={{
            width: '100%', padding: '8px 12px', fontSize: 15, borderRadius: 5,
            border: `1px solid ${C.border}`, background: C.inputBg, color: C.text,
            outline: 'none', boxSizing: 'border-box', marginBottom: 20,
          }}
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={cancelBtnStyle}>{cancelLabel}</button>
          <button onClick={() => onOk(value)} style={okBtnStyle(okColor)}>{okLabel}</button>
        </div>
      </div>
    </div>
  );
}
