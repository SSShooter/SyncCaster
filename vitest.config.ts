import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@synccaster/core': resolve(__dirname, './packages/core/src'),
      '@synccaster/adapters': resolve(__dirname, './packages/adapters/src'),
      '@synccaster/agent-protocol': resolve(__dirname, './packages/agent-protocol/src'),
      '@synccaster/utils': resolve(__dirname, './packages/utils/src'),
    },
  },
});
