// eslint-config-next 16 ships native flat config, so it is spread directly —
// `FlatCompat` is not needed (and throws on this config).
import next from 'eslint-config-next';
import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'coverage/**',
    ],
  },
  ...next,
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Data-fetching hooks legitimately subscribe to external systems on mount: loading todos
    // from the API, reading `Notification.permission`, reading `localStorage`. None of these
    // values exist during render (several are browser-only), so an effect is the correct
    // place for them — which is exactly the "subscribe for updates from some external
    // system" case the rule's own docs carve out. The rule cannot see through the async
    // `refresh()` indirection, so it is disabled for this directory only.
    files: ['lib/hooks/**/*.ts'],
    rules: { 'react-hooks/set-state-in-effect': 'off' },
  },
];

export default config;
