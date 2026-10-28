import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'dist-feasibility/**', '**/vendor/**', '.cache/**', '.venv/**'] },
  js.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.worker } },
    rules: {
      complexity: ['error', 8],
      'max-depth': ['error', 3],
      'max-params': ['error', 5],
      'max-statements': ['error', 35],
      'max-lines-per-function': ['error', { max: 65, skipBlankLines: true, skipComments: true }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'eqeqeq': 'error',
      'curly': 'error',
    },
  },
];
