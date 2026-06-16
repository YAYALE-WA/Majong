import { describe, it, expect } from 'vitest';
import { ENGINE_VERSION } from '../src/index';

describe('smoke', () => {
  it('exposes version', () => {
    expect(ENGINE_VERSION).toBe('1.0.0');
  });
});
