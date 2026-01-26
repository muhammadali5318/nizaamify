// eslint.config.cjs

/* eslint-disable no-undef, @typescript-eslint/no-require-imports */
/* eslint-env node */

const { FlatCompat } = require('@eslint/eslintrc')
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: require('@eslint/js').configs.recommended // Required for ESLint 9+
})

const globals = require('globals')
const tsParser = require('@typescript-eslint/parser')
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const react = require('eslint-plugin-react')
const importPlugin = require('eslint-plugin-import')
const promise = require('eslint-plugin-promise')
const prettier = require('eslint-plugin-prettier')
const jsxA11y = require('eslint-plugin-jsx-a11y')

module.exports = [
  // Ignore build and config files
  {
    ignores: ['dist', 'node_modules', '**/*.config.js', '**/*.config.ts']
  },

  // Legacy ESLint configs (converted) — placed BEFORE custom overrides
  ...compat.extends(
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:promise/recommended',
    'plugin:prettier/recommended',
    'plugin:jsx-a11y/recommended'
  ),

  // Main config for JS/TS/React
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        tsconfigRootDir: __dirname
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021
      }
    },
    settings: {
      react: {
        version: 'detect' // Automatically detect installed React version
      },
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx']
        }
      }
    },
    plugins: {
      react,
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
      promise,
      prettier,
      'jsx-a11y': jsxA11y
    },
    rules: {
      // General
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'global-require': 'off',

      // React
      'react/destructuring-assignment': 'off',
      'react/jsx-props-no-spreading': 'off',
      'react/state-in-constructor': 'off',
      'react/prop-types': 'off',
      'react/require-default-props': 'off',
      'react/react-in-jsx-scope': 'off', // ✅ Fixes your issue
      'react/jsx-uses-react': 'off',

      // TypeScript
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',

      // Import rules
      'import/no-unresolved': 'off',
      'import/named': 'off',
      'import/no-named-as-default-member': 'off',

      // Accessibility
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/anchor-is-valid': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/label-has-associated-control': 'warn'
    }
  }
]
