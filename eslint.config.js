// ESLint flat config (ESLint v10) for PovesteaNoastra — Expo SDK 57 / React Native / TypeScript.
// See CLAUDE.md for the project's stack and conventions.

const js = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const prettierConfig = require('eslint-config-prettier');
const globals = require('globals');

module.exports = [
  // Files/folders ESLint should never look at: generated native projects,
  // dependencies, Expo/Metro caches and build output, and generated types.
  {
    ignores: [
      'node_modules/**',
      'ios/**',
      'android/**',
      '.expo/**',
      'dist/**',
      'web-build/**',
      'expo-env.d.ts',
      'supabase/.temp/**',
      '*.log',
    ],
  },

  // Base JS rules.
  js.configs.recommended,

  // TypeScript support (@typescript-eslint) — non-type-checked "recommended"
  // set. A couple of the plugin's own config entries ship with no `files`
  // restriction (meaning "every file"); pin every entry to .ts/.tsx (and
  // .mts/.cts) explicitly so plain CommonJS scripts (babel.config.js,
  // scripts/reset-test-data.js, this file) stay on the default JS parser
  // and rule set instead of picking up TS-only rules like
  // `no-require-imports`.
  ...tseslint.configs['flat/recommended'].map((config) => ({
    ...config,
    files: config.files ?? ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
  })),

  // React + React Hooks rules for TS/TSX and JS/JSX source.
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      // React 19 / the automatic JSX runtime (used throughout this app) means
      // React never needs to be in scope and never needs to be imported.
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.flat.recommended.rules,
      // TypeScript already enforces prop shapes; PropTypes are unused here.
      'react/prop-types': 'off',
    },
  },

  // Project-wide language options: React Native app code (app/, components/,
  // hooks/, data/, utils/, types/) runs in the RN JS runtime, not a browser
  // or Node.
  {
    files: ['app/**/*.{js,jsx,ts,tsx}', 'components/**/*.{js,jsx,ts,tsx}', 'hooks/**/*.{js,jsx,ts,tsx}', 'data/**/*.{js,jsx,ts,tsx}', 'utils/**/*.{js,jsx,ts,tsx}', 'types/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals['react-native'],
      },
    },
  },

  // Node-context files: config files and the reset-test-data script run
  // under plain Node, not the RN runtime.
  {
    files: ['*.config.js', 'babel.config.js', 'metro.config.js', 'eslint.config.js', 'scripts/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'commonjs',
    },
  },

  // TypeScript-specific rule tuning for this codebase. (Parser is already
  // set globally by the `typescript-eslint` "flat/recommended" spread above.)
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Unused imports/vars are a real, common bug source here (see
      // CLAUDE.md's own `npx tsc --noEmit --noUnusedLocals` convention) —
      // keep this as a warning rather than off, but allow a `_`-prefixed
      // arg/var as a deliberate ignore.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // This codebase leans on `any` in a handful of Supabase/RevenueCat
      // boundary spots; keep it visible as a warning rather than blocking.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Disables every stylistic ESLint rule that would conflict with Prettier
  // (the project already has Prettier as a devDependency) — must stay last
  // so nothing above re-enables a formatting rule after this.
  prettierConfig,
];
