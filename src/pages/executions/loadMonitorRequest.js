// Each resource has its own counter: an older success or error cannot publish state.
export const loadMonitorRequest = async ({ requestRef, load, onChange, errorMessage }) => {
  const generation = ++requestRef.current
  onChange((current) => ({ ...current, loading: true, error: null }))

  try {
    const response = await load()
    if (requestRef.current !== generation) return

    onChange({
      data: Array.isArray(response.data) ? response.data : [],
      loading: false,
      error: null,
    })
  } catch {
    if (requestRef.current !== generation) return

    onChange((current) => ({ ...current, loading: false, error: errorMessage }))
  }
}
