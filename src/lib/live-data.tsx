import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { api, type ApiHealth, type ApiModel } from './api'

type LiveData = {
  health: ApiHealth | null
  models: Array<ApiModel> | null
  err: string | null
  refresh: () => Promise<void>
}

const Ctx = createContext<LiveData | null>(null)

const POLL_MS = 5_000

export function LiveDataProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<ApiHealth | null>(null)
  const [models, setModels] = useState<Array<ApiModel> | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const [h, m] = await Promise.all([api.health(), api.listModels()])
      if (!mounted.current) return
      setHealth(h)
      setModels(m.models)
      setErr(null)
    } catch (e) {
      if (!mounted.current) return
      setErr(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => {
      mounted.current = false
      clearInterval(id)
    }
  }, [refresh])

  return <Ctx.Provider value={{ health, models, err, refresh }}>{children}</Ctx.Provider>
}

export function useLiveData(): LiveData {
  const v = useContext(Ctx)
  if (!v) throw new Error('useLiveData must be used inside <LiveDataProvider>')
  return v
}
