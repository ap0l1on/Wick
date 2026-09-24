// ESLint flat config — enforces the M8 security gate: no innerHTML, no eval.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'public/puzzles.json'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-properties': [
        'error',
        { object: 'Element', property: 'innerHTML', message: 'Render guess text as text, never innerHTML (M8).' },
        { object: 'Document', property: 'write', message: 'No document.write (M8).' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'eval', message: 'No eval (M8).' },
      ],
    },
  },
);
