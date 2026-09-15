import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// This repo imports test globals explicitly rather than enabling vitest's `globals` option, so
// RTL's own auto-cleanup (which only registers when it finds a global `afterEach`) never kicks in
// on its own — wire it up here instead, otherwise each test's render stays mounted into the next.
afterEach(cleanup);
