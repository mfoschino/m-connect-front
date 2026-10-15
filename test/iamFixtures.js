export const createMemoryStorage = (seed = {}) => {
  const values = new Map(Object.entries(seed))
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => { values.set(key, String(value)) },
    removeItem: (key) => { values.delete(key) },
    entries: () => [...values.entries()],
  }
}

export const createStorageEvents = () => {
  const listeners = new Set()
  return {
    addEventListener: (type, listener) => { if (type === 'storage') listeners.add(listener) },
    removeEventListener: (type, listener) => { if (type === 'storage') listeners.delete(listener) },
    dispatch: (event) => listeners.forEach((listener) => listener(event)),
    listenerCount: () => listeners.size,
  }
}

export const createSerialCoordinator = () => {
  const tails = new Map()
  return {
    runExclusive: (name, operation) => {
      const previous = tails.get(name) ?? Promise.resolve()
      const work = previous.then(operation, operation)
      tails.set(name, work.catch(() => {}))
      return work
    },
  }
}

export const tokenPair = (suffix = 'one') => ({
  accessToken: `access-${suffix}`,
  refreshToken: `refresh-${suffix}`,
  tokenType: 'bearer',
  expiresIn: 60,
})

export const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
