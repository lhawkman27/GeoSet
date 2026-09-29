import { getDynamicPointZoomScale } from '../../src/utils/pointSize';

describe('getDynamicPointZoomScale', () => {
  it('keeps the configured size through zoom 4', () => {
    expect(getDynamicPointZoomScale(0)).toBe(1);
    expect(getDynamicPointZoomScale(4)).toBe(1);
  });

  it('gradually increases point size above zoom 4', () => {
    expect(getDynamicPointZoomScale(6)).toBe(1.5);
    expect(getDynamicPointZoomScale(8)).toBe(2);
  });

  it('caps the multiplier at 3.5', () => {
    expect(getDynamicPointZoomScale(24)).toBe(3.5);
    expect(getDynamicPointZoomScale(30)).toBe(3.5);
  });

  it('falls back safely for an invalid zoom', () => {
    expect(getDynamicPointZoomScale(Number.NaN)).toBe(1);
  });
});
