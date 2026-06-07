import { useState, useEffect, useCallback } from 'react'
import {
  isConnected,
  getAddress,
  signTransaction,
} from '@stellar/freighter-api'

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)

  const connect = useCallback(async () => {
    setLoading(true)
    try {
      const connectedResult = await isConnected()
      if (connectedResult.isConnected) {
        const addrResult = await getAddress()
        if (addrResult.error) {
          throw new Error(addrResult.error)
        }
        setAddress(addrResult.address)
        setConnected(true)
      }
    } catch {
      setConnected(false)
      setAddress(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    connect()
  }, [connect])

  const signTx = useCallback(async (
    txXdr: string,
    opts?: { networkPassphrase?: string; address?: string }
  ) => {
    const result = await signTransaction(txXdr, {
      networkPassphrase: opts?.networkPassphrase ?? 'Test SDF Network ; September 2015',
      address: opts?.address ?? address ?? undefined,
    })
    if (result.error) throw new Error(result.error)
    return result.signedTxXdr
  }, [address])

  return { address, connected, loading, connect, signTx }
}
