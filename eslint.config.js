const nodeGlobals = {
  console: 'readonly',
  process: 'readonly'
};

export default [
  {
    files: [
      'src/calculators/**/*.js',
      'src/presenters/**/*.js',
      'src/services/inventoryTransferService.js',
      'tests/inventory-transfer-service.test.js'
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {
      'no-dupe-keys': 'error',
      'no-fallthrough': 'error',
      'no-undef': 'error',
      'no-unreachable': 'error'
    }
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: nodeGlobals
    },
    rules: {
      'no-dupe-keys': 'error',
      'no-fallthrough': 'error',
      'no-undef': 'error',
      'no-unreachable': 'error'
    }
  }
];
