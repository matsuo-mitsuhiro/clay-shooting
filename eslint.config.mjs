import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

export default [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'manual/**',
      'public/manual/**',
      'scripts/**',
      'e2e/**',
      'playwright-report/**',
      'test-results/**',
      'windows-eperm-fix.js',
      'next.config.ts',
    ],
  },
  {
    rules: {
      // プロジェクト方針に合わせて緩和
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
      'react/no-unescaped-entities': 'off',
      '@next/next/no-img-element': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      // 既存コードに多数存在するため、まず警告に降格（後続PRで段階的に修正）
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      '@next/next/no-html-link-for-pages': 'warn',
      'import/no-anonymous-default-export': 'off',
      // Tailwind 化（D+ 段階導入）: 新規の inline style={{}} を抑止し Tailwind utility を促す。
      // 既存 1689 件は warning として残し、触ったファイル単位で段階的に utility 化する。
      // 詳細は CLAUDE.md「スタイリング方針」参照。
      'react/forbid-dom-props': ['warn', {
        forbid: [{
          propName: 'style',
          message: 'インライン style ではなく Tailwind utility (bg-bg, text-text, bg-gold, border-border 等) を使ってください。既存箇所は触ったタイミングで段階的に移行してください。',
        }],
      }],
    },
  },
];
