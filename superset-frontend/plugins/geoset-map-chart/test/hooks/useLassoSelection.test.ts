import { renderHook, act } from '@testing-library/react-hooks';
import { useLassoSelection } from '../../src/hooks/useLassoSelection';

describe('useLassoSelection', () => {
  it('returns correct initial state', () => {
    const { result } = renderHook(() => useLassoSelection());
    expect(result.current.lassoIsActive).toBe(false);
    expect(result.current.lassoDrawMode).toBe('freehand');
    expect(result.current.selectedLassoLayerIds).toEqual([]);
  });

  it('activates lasso on handleLassoActivate', () => {
    const { result } = renderHook(() => useLassoSelection());
    act(() => result.current.handleLassoActivate());
    expect(result.current.lassoIsActive).toBe(true);
  });

  it('calls onActivate callback when activated', () => {
    const onActivate = jest.fn();
    const { result } = renderHook(() => useLassoSelection({ onActivate }));
    act(() => result.current.handleLassoActivate());
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('deactivates and clears layers on handleLassoToggle', () => {
    const { result } = renderHook(() =>
      useLassoSelection({
        availableLayers: [
          { id: '1', name: 'Layer 1' },
          { id: '2', name: 'Layer 2' },
        ],
      }),
    );

    // Activate and verify layer is auto-selected
    act(() => result.current.handleLassoActivate());
    expect(result.current.lassoIsActive).toBe(true);
    expect(result.current.selectedLassoLayerIds).toEqual(['1']);

    // Toggle off — should clear everything
    act(() => result.current.handleLassoToggle());
    expect(result.current.lassoIsActive).toBe(false);
    expect(result.current.selectedLassoLayerIds).toEqual([]);
  });

  it('deactivates without clearing layers on deactivateLasso', () => {
    const { result } = renderHook(() =>
      useLassoSelection({
        availableLayers: [{ id: '1', name: 'Layer 1' }],
      }),
    );

    act(() => result.current.handleLassoActivate());
    expect(result.current.selectedLassoLayerIds).toEqual(['1']);

    // Soft deactivation — layers preserved
    act(() => result.current.deactivateLasso());
    expect(result.current.lassoIsActive).toBe(false);
    expect(result.current.selectedLassoLayerIds).toEqual(['1']);
  });

  it('changes draw mode via setLassoDrawMode', () => {
    const { result } = renderHook(() => useLassoSelection());
    act(() => result.current.setLassoDrawMode('polygon'));
    expect(result.current.lassoDrawMode).toBe('polygon');
  });

  it('toggles layer ids on handleLassoLayerToggle', () => {
    const { result } = renderHook(() => useLassoSelection());

    act(() => result.current.handleLassoLayerToggle('a'));
    expect(result.current.selectedLassoLayerIds).toEqual(['a']);

    act(() => result.current.handleLassoLayerToggle('b'));
    expect(result.current.selectedLassoLayerIds).toEqual(['a', 'b']);

    // Toggle 'a' off
    act(() => result.current.handleLassoLayerToggle('a'));
    expect(result.current.selectedLassoLayerIds).toEqual(['b']);
  });

  it('auto-selects first layer when availableLayers provided', () => {
    const { result } = renderHook(() =>
      useLassoSelection({
        availableLayers: [
          { id: 'x', name: 'X' },
          { id: 'y', name: 'Y' },
        ],
      }),
    );
    expect(result.current.selectedLassoLayerIds).toEqual(['x']);
  });

  it('does not auto-select when layers are already selected', () => {
    const { result } = renderHook(() =>
      useLassoSelection({
        availableLayers: [{ id: 'x', name: 'X' }],
      }),
    );

    // Manually toggle to 'y', then re-render with new available layers
    act(() => result.current.handleLassoLayerToggle('y'));
    expect(result.current.selectedLassoLayerIds).toContain('y');
  });

  it('calls onPolygonComplete when handleLassoComplete is called', () => {
    const onPolygonComplete = jest.fn();
    const { result } = renderHook(() =>
      useLassoSelection({ onPolygonComplete }),
    );
    const polygon = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ];
    act(() => result.current.handleLassoComplete(polygon));
    expect(onPolygonComplete).toHaveBeenCalledWith(polygon);
  });

  it('deactivates lasso on Escape key', () => {
    const { result } = renderHook(() => useLassoSelection());

    act(() => result.current.handleLassoActivate());
    expect(result.current.lassoIsActive).toBe(true);

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape' }),
      );
    });
    expect(result.current.lassoIsActive).toBe(false);
  });

  it('does not deactivate on Escape when lasso is inactive', () => {
    const { result } = renderHook(() => useLassoSelection());
    expect(result.current.lassoIsActive).toBe(false);

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape' }),
      );
    });
    // Should still be false, no errors
    expect(result.current.lassoIsActive).toBe(false);
  });

  it('does not fire Escape listener after unmount', () => {
    const { result, unmount } = renderHook(() => useLassoSelection());

    act(() => result.current.handleLassoActivate());
    unmount();

    // Should not throw
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape' }),
    );
  });

  it('uses latest onPolygonComplete callback without stale closures', () => {
    const first = jest.fn();
    const second = jest.fn();

    const { result, rerender } = renderHook(
      ({ cb }) => useLassoSelection({ onPolygonComplete: cb }),
      { initialProps: { cb: first } },
    );

    rerender({ cb: second });

    const polygon = [[0, 0]];
    act(() => result.current.handleLassoComplete(polygon));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(polygon);
  });
});
