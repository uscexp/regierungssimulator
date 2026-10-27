import { describe, expect, it } from 'vitest';

import { CORE_PLACEHOLDER } from '@staatslenker/core';

describe('Toolchain-Smoke', () => {
  it('Kern-Package ist ladbar und enthält keinen Spielcode', () => {
    expect(CORE_PLACEHOLDER).toBe(true);
  });
});
