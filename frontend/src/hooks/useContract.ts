import { useCallback, useState } from 'react'
import {
  Contract,
  Keypair,
  Transaction,
  TransactionBuilder,
  BASE_FEE,
  Networks,
  nativeToScVal,
  scValToNative,
  Account,
} from '@stellar/stellar-sdk'
import { Server, Api } from '@stellar/stellar-sdk/rpc'

const RPC_URL = 'https://mainnet.sorobanrpc.com'
const NETWORK_PASSPHRASE = Networks.PUBLIC
const SIM_SOURCE = Keypair.random().publicKey()

function toScVal(val: unknown): import('@stellar/stellar-sdk').xdr.ScVal {
  if (typeof val === 'bigint') return nativeToScVal(val, { type: 'i128' })
  if (typeof val === 'number') return nativeToScVal(val, { type: 'i128' })
  if (typeof val === 'string') return nativeToScVal(val, { type: 'symbol' })
  return nativeToScVal(val)
}

export function useContract(contractId: string | null) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const server = new Server(RPC_URL)

  const read = useCallback(async <T,>(method: string, args: unknown[] = []): Promise<T | null> => {
    if (!contractId) return null
    setLoading(true)
    setError(null)
    try {
      const contract = new Contract(contractId)
      const operation = contract.call(method, ...args.map(toScVal))
      const account = new Account(SIM_SOURCE, '0')
      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(operation)
        .setTimeout(30)
        .build()

      const simResponse = await server.simulateTransaction(tx)
      if (Api.isSimulationError(simResponse)) {
        setError(simResponse.error)
        return null
      }
      const retval = simResponse.result?.retval
      if (!retval) return null
      return scValToNative(retval) as T
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      return null
    } finally {
      setLoading(false)
    }
  }, [contractId])

  const getDeadline = useCallback(() => read<number>('get_deadline'), [read])
  const getContractBalance = useCallback(() => read<number>('get_contract_balance'), [read])
  const getSwitchStatus = useCallback(() => read<number>('get_switch_status'), [read])

  const write = useCallback(async (
    method: string,
    args: unknown[],
    source: string,
    signTx: (txXdr: string, opts?: { networkPassphrase?: string }) => Promise<string>,
  ) => {
    if (!contractId) return null
    setLoading(true)
    setError(null)
    try {
      const contract = new Contract(contractId)
      const operation = contract.call(method, ...args.map(toScVal))
      const account = await server.getAccount(source)
      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(operation)
        .setTimeout(30)
        .build()

      const prepared = await server.prepareTransaction(tx)
      const xdrToSign = prepared.toXDR()
      const signedXdr = await signTx(xdrToSign, { networkPassphrase: NETWORK_PASSPHRASE })
      const signedTx = new Transaction(signedXdr, NETWORK_PASSPHRASE)
      const sendResponse = await server.sendTransaction(signedTx)

      if (sendResponse.status === 'PENDING' || sendResponse.status === 'DUPLICATE') {
        const hash = sendResponse.hash
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 1000))
          const getResponse = await server.getTransaction(hash)
          if (getResponse.status === Api.GetTransactionStatus.SUCCESS) {
            return getResponse.returnValue
              ? scValToNative(getResponse.returnValue)
              : null
          }
          if (getResponse.status === Api.GetTransactionStatus.FAILED) {
            throw new Error('Transaction failed on-chain')
          }
        }
        throw new Error('Transaction timed out')
      }
      if (sendResponse.status === 'ERROR') {
        let reason = 'unknown'
        try {
          reason = sendResponse.errorResult?.result().switch().name ?? 'unknown'
        } catch {}
        throw new Error(`Transaction rejected: ${reason}`)
      }
      return null
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      return null
    } finally {
      setLoading(false)
    }
  }, [contractId])

  return {
    loading,
    error,
    getDeadline,
    getContractBalance,
    getSwitchStatus,
    write,
    clearError: () => setError(null),
  }
}
