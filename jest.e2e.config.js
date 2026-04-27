// ABOUTME: Jest configuration for end-to-end tests. Targets tests/e2e/ only.
'use strict';

module.exports = {
  testMatch: ['**/tests/e2e/**/*.test.js'],
  testTimeout: 60000,
  testEnvironment: 'node',
};
