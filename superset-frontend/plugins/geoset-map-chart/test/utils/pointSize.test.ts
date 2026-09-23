import { getDynamicPointZoomScale } from '../../src/utils/pointSize';

describe('getDynamicPointZoomScale', () => {
  it('keeps the configured size through zoom 8', () => {
    expect(getDynamicPointZoomScale(0)).toBe(1);
    expect(getDynamicPointZoomScale(8)).toBe(1);
  });

  it('gradually increases point size above zoom 8', () => {
    expect(getDynamicPointZoomScale(10)).toBe(1.25);
    expect(getDynamicPointZoomScale(12)).toBe(1.5);
  });

  it('caps the multiplier at 2.5', () => {
    expect(getDynamicPointZoomScale(20)).toBe(2.5);
    expect(getDynamicPointZoomScale(22)).toBe(2.5);
  });

  it('falls back safely for an invalid zoom', () => {
    expect(getDynamicPointZoomScale(Number.NaN)).toBe(1);
  });
});
