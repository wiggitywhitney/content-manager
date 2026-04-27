// ABOUTME: Jest configuration for integration tests. Targets tests/integration/ only.
'use strict';

module.exports = {
  testMatch: ['**/tests/integration/**/*.test.js'],
  testTimeout: 30000,
  testEnvironment: 'node',
};
