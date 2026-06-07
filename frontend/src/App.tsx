import { useState, useEffect, useCallback } from 'react'
import { useWallet } from './hooks/useWallet'
import { useContract } from './hooks/useContract'

const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID ?? ''

function formatTime(seconds: number): string {
  if (seconds <= 0) return 'EXPIRED'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const parts: string[] = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m}m`)
  parts.push(`${s}s`)
  return parts.join(' ')
}

export default function App() {
  const { address, connected, loading: walletLoading, connect, signTx } = useWallet()
  const {
    loading: contractLoading,
    error: contractError,
    getDeadline,
    getContractBalance,
    getSwitchStatus,
    write,
    clearError,
  } = useContract(CONTRACT_ID)

  const [deadline, setDeadline] = useState<number | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [switchStatus, setSwitchStatus] = useState<number | null>(null)
  const [depositAmount, setDepositAmount] = useState('')
  const [isOwner, setIsOwner] = useState(false)
  const [isBeneficiary, setIsBeneficiary] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const refreshState = useCallback(async () => {
    const [dl, bal, status] = await Promise.all([
      getDeadline(),
      getContractBalance(),
      getSwitchStatus(),
    ])
    if (dl !== null) setDeadline(dl)
    if (bal !== null) setBalance(bal)
    if (status !== null) setSwitchStatus(status)
  }, [getDeadline, getContractBalance, getSwitchStatus])

  useEffect(() => {
    if (connected && CONTRACT_ID) {
      refreshState()
    }
  }, [connected, CONTRACT_ID, refreshState])

  useEffect(() => {
    if (deadline !== null && deadline > 0) {
      const tick = () => {
        const remaining = Math.max(0, deadline - Math.floor(Date.now() / 1000))
        setCountdown(remaining)
      }
      tick()
      const interval = setInterval(tick, 1000)
      return () => clearInterval(interval)
    }
  }, [deadline])

  const handleDeposit = useCallback(async () => {
    if (!address || !depositAmount) return
    const parsed = parseFloat(depositAmount)
    if (isNaN(parsed) || parsed <= 0) return
    const amount = BigInt(Math.floor(parsed * 1e7))
    await write('deposit_funds', [amount], address, signTx)
    setDepositAmount('')
    refreshState()
  }, [address, depositAmount, write, signTx, refreshState])

  const handlePing = useCallback(async () => {
    if (!address) return
    await write('ping_alive', [], address, signTx)
    refreshState()
  }, [address, write, signTx, refreshState])

  const handleClaim = useCallback(async () => {
    if (!address) return
    await write('claim_inheritance', [], address, signTx)
    refreshState()
  }, [address, write, signTx, refreshState])

  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Dead Man's Switch
            </h1>
            <p className="text-gray-400 text-sm">Digital Inheritance Vault on Stellar</p>
          </div>
          <button
            onClick={connect}
            disabled={walletLoading}
            className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 transition-all font-medium text-white shadow-lg shadow-purple-900/30"
          >
            {walletLoading ? 'Connecting...' : 'Connect Freighter Wallet'}
          </button>
          {!CONTRACT_ID && (
            <p className="text-yellow-400 text-sm mt-4">
              Set VITE_CONTRACT_ID environment variable
            </p>
          )}
        </div>
      </div>
    )
  }

  const expired = countdown <= 0 && deadline !== null && deadline > 0

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Dead Man's Switch
            </h1>
            <p className="text-gray-500 text-xs">Digital Inheritance Vault</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-gray-400 text-sm font-mono truncate max-w-[160px]">
              {address?.slice(0, 4)}...{address?.slice(-4)}
            </span>
          </div>
        </header>

        {contractError && (
          <div className="p-4 rounded-xl bg-red-900/30 border border-red-800 text-red-300 text-sm">
            {contractError}
            <button onClick={clearError} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 rounded-xl bg-gray-900/50 border border-gray-800">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Locked Balance</p>
            <p className="text-3xl font-bold text-white">
              {balance !== null ? (balance / 1e7).toFixed(2) : '---'}
            </p>
            <p className="text-gray-500 text-xs">tokens</p>
          </div>
          <div className="p-6 rounded-xl bg-gray-900/50 border border-gray-800">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Switch Status</p>
            <p className={`text-3xl font-bold ${expired ? 'text-red-400' : 'text-emerald-400'}`}>
              {switchStatus !== null ? formatTime(switchStatus) : '---'}
            </p>
            <p className="text-gray-500 text-xs">{expired ? 'Expired' : 'remaining'}</p>
          </div>
          <div className="p-6 rounded-xl bg-gray-900/50 border border-gray-800">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Deadline</p>
            <p className="text-3xl font-bold text-white">
              {deadline !== null && deadline > 0
                ? new Date(deadline * 1000).toLocaleDateString()
                : '---'}
            </p>
            <p className="text-gray-500 text-xs">
              {deadline !== null && deadline > 0
                ? new Date(deadline * 1000).toLocaleTimeString()
                : 'not set'}
            </p>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-gray-900/50 border border-gray-800">
          {isOwner ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Owner Panel</h2>
              <div className="flex gap-3">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  placeholder="Amount to deposit"
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleDeposit}
                  disabled={contractLoading || !depositAmount}
                  className="px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition-colors font-medium"
                >
                  Deposit
                </button>
              </div>
              <button
                onClick={handlePing}
                disabled={contractLoading}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 transition-all font-semibold text-lg tracking-wide"
              >
                {contractLoading ? 'Processing...' : "I'M ALIVE (PING)"}
              </button>
            </div>
          ) : isBeneficiary ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Beneficiary Panel</h2>
              <button
                onClick={handleClaim}
                disabled={contractLoading || !expired}
                className={`w-full py-3 rounded-lg font-semibold text-lg tracking-wide transition-all ${
                  expired
                    ? 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 cursor-pointer'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                {contractLoading
                  ? 'Processing...'
                  : expired
                    ? 'CLAIM INHERITANCE'
                    : `Claim available in ${formatTime(countdown)}`}
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-400">Connect as the owner or beneficiary to interact</p>
              <p className="text-gray-600 text-sm mt-1">Current address: {address}</p>
              <button
                onClick={() => { setIsOwner(true); setIsBeneficiary(false) }}
                className="mt-4 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-sm mr-2"
              >
                I'm the Owner
              </button>
              <button
                onClick={() => { setIsBeneficiary(true); setIsOwner(false) }}
                className="mt-4 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-sm"
              >
                I'm the Beneficiary
              </button>
            </div>
          )}
        </div>

        {contractLoading && (
          <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
            <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            Transaction in progress...
          </div>
        )}
      </div>
    </div>
  )
}
