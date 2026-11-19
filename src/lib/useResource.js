import { useCallback, useEffect, useState } from 'react'
import { friendlyError } from './errors'

const shared = new Map()

function share(key, run) {
  const hit = shared.get(key)
  if (hit && Date.now() - hit.at < 2000) return hit.promise
  const promise = Promise.resolve()
    .then(run)
    .catch((error) => {
      if (shared.get(key)?.promise === promise) shared.delete(key)
      throw error
    })
  shared.set(key, { at: Date.now(), promise })
  return promise
}

export function useResource(loader, deps = []) {
  const key = `${loader.toString()}\n${JSON.stringify(deps)}`
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    shared.delete(key)
    setLoading(true)
    setError('')
    try {
      setData(await loader())
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }, [key])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    share(key, loader)
      .then((next) => {
        if (!active) return
        setData(next)
      })
      .catch((err) => {
        if (!active) return
        setError(friendlyError(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [key])

  return { data, loading, error, reload, setData }
}
