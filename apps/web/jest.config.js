/**
 * Unit tests for the pure logic the UI depends on — link building, redirect
 * targets, session resolution. No DOM: these are the decisions that broke in a
 * browser and are cheap to pin down without rendering anything.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\.spec\.ts$',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
};
