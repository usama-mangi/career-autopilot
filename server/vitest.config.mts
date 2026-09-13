import { defineConfig } from 'vitest/config';

// Deterministic dates: calendar and window tests reason in UTC.
process.env.TZ ||= 'UTC';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    globals: false,
    restoreMocks: true,
    // Tests must run offline and never load .env; services under test get
    // explicit config values through mocked ConfigService.
    testTimeout: 10_000,
  },
});
