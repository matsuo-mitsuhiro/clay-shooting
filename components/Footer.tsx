import { C } from '@/lib/colors';

export default function Footer() {
  return (
    <footer style={{
      textAlign: 'center',
      padding: '16px',
      color: C.muted,
      fontSize: 12,
      borderTop: `1px solid ${C.border}`,
      marginTop: 'auto',
    }}>
      © 2026–present Mitsuhiro Matsuo. All rights reserved.
    </footer>
  );
}
