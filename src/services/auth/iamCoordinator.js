export class IamCoordinationError extends Error {
  constructor() {
    super('coordination_unavailable')
    this.name = 'IamCoordinationError'
    this.code = 'coordination_unavailable'
  }
}

export const createWebLockCoordinator = ({ locks } = {}) => {
  const assertAvailable = () => {
    const available = locks ?? globalThis.navigator?.locks
    if (!available || typeof available.request !== 'function') {
      throw new IamCoordinationError()
    }
    return available
  }
  return { assertAvailable,
    runExclusive: async (name, operation) => {
      const available = assertAvailable()
      // El nombre sólo contiene el alcance público de la API, nunca tokens.
      let entered = false
      try {
        return await available.request(name, { mode: 'exclusive' }, () => {
          entered = true
          return operation()
        })
      } catch (error) {
        if (!entered) throw new IamCoordinationError()
        throw error
      }
    },
  }
}
