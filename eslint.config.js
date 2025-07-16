module.exports = [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        global: 'readonly'
      }
    },
    files: ['src/**/*.js', 'examples/**/*.js'],
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
      'indent': ['error', 2],
      'comma-dangle': ['error', 'never'],
      'no-trailing-spaces': 'error',
      'eol-last': 'error',
      'no-multiple-empty-lines': ['error', { max: 1 }],
      'prefer-const': 'error',
      'no-var': 'error',
      'arrow-spacing': 'error',
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'key-spacing': ['error', { beforeColon: false, afterColon: true }],
      'space-before-blocks': 'error',
      'space-infix-ops': 'error',
      'keyword-spacing': 'error',
      'func-call-spacing': ['error', 'never'],
      'no-multi-spaces': 'error',
      'space-before-function-paren': ['error', 'never'],
      'brace-style': ['error', '1tbs', { allowSingleLine: true }],
      'curly': ['error', 'multi-line'],
      'dot-notation': 'error',
      'eqeqeq': ['error', 'always'],
      'no-else-return': 'error',
      'no-empty-function': 'warn',
      'no-implicit-coercion': 'error',
      'no-return-await': 'error',
      'no-throw-literal': 'error',
      'no-unneeded-ternary': 'error',
      'no-useless-return': 'error'
    }
  }
];