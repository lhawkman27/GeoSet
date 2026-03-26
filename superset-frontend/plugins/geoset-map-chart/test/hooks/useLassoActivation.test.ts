import { renderHook, act } from '@testing-library/react-hooks';
import { useLassoActivation } from '../../src/hooks/useLassoActivation';

describe('useLassoActivation', () => {
  it('returns correct initial state', () => {
    const { result } = renderHook(() => useLassoActivation());
    expect(result.current.lassoIsActive).toBe(false);
    expect(result.current.lassoDrawMode).toBe('freehand');
    expect(result.current.selectedLassoLayerId).toBeUndefined();
  });

  it('activates lasso and calls onActivate', () => {
    const onActivate = jest.fn();
    const { result } = renderHook(() =>
      useLassoActivation({ onActivate }),
    );
    act(() => result.current.handleLassoActivate());
    expect(result.current.lassoIsActive).toBe(true);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('deactivateLasso preserves layer selection', () => {
    const { result } = renderHook(() =>
      useLassoActivation({
        availableLayers: [{ id: '1', name: 'Layer 1' }],
      }),
    );
    act(() => result.current.handleLassoActivate());
    expect(result.current.selectedLassoLayerId).toBe('1');

    act(() => result.current.deactivateLasso());
    expect(result.current.lassoIsActive).toBe(false);
    expect(result.current.selectedLassoLayerId).toBe('1');
  });

  it('resetActivation clears both active state and layer selection', () => {
    const { result } = renderHook(() =>
      useLassoActivation({
        availableLayers: [{ id: '1', name: 'Layer 1' }],
      }),
    );
    act(() => result.current.handleLassoActivate());
    act(() => result.current.resetActivation());
    expect(result.current.lassoIsActive).toBe(false);
    expect(result.current.selectedLassoLayerId).toBeUndefined();
  });

  it('auto-selects first layer when availableLayers provided', () => {
    const { result } = renderHook(() =>
      useLassoActivation({
        availableLayers: [
          { id: 'x', name: 'X' },
          { id: 'y', name: 'Y' },
        ],
      }),
    );
    expect(result.current.selectedLassoLayerId).toBe('x');
  });

  it('changes draw mode via setLassoDrawMode', () => {
    const { result } = renderHook(() => useLassoActivation());
    act(() => result.current.setLassoDrawMode('polygon'));
    expect(result.current.lassoDrawMode).toBe('polygon');
  });

  it('selects a layer via handleLassoLayerSelect', () => {
    const { result } = renderHook(() => useLassoActivation());
    act(() => result.current.handleLassoLayerSelect('a'));
    expect(result.current.selectedLassoLayerId).toBe('a');
  });

  it('uses latest onActivate callback without stale closures', () => {
    const first = jest.fn();
    const second = jest.fn();
    const { result, rerender } = renderHook(
      ({ cb }) => useLassoActivation({ onActivate: cb }),
      { initialProps: { cb: first } },
    );

    rerender({ cb: second });
    act(() => result.current.handleLassoActivate());

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
