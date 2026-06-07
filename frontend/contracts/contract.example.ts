// Adapted from stellar-contracts-kit example
// Contract : CCK3W5FW2MY7IX7PZ65O7R6WYFLXRKDKT5MCIHVAHPIPRHZ223BPTU4N
// Network  : mainnet

import type { Contract } from './contract.js'
import { CONTRACT_ID } from './contract.js'
import { useWallet } from '../hooks/useWallet'
import { useContract } from '../hooks/useContract'

// Example hook using the typed contract
export function useTypedContract() {
  const { address, signTx } = useWallet()
  const { write, getDeadline, getContractBalance, getSwitchStatus } = useContract(CONTRACT_ID)

  const contract: Contract = {
    ping_alive: {
      invoke: async () => {
        if (!address) throw new Error('Wallet not connected')
        const txHash = await write('ping_alive', [], address, signTx)
        return { txHash: txHash ?? '' }
      },
      read: async () => ({ result: undefined as unknown as void }),
    },
    get_deadline: {
      invoke: async () => { throw new Error('Read-only') },
      read: async () => {
        const result = await getDeadline()
        return { result: (result ?? 0) as unknown as bigint }
      },
    },
    deposit_funds: {
      invoke: async (amount: bigint) => {
        if (!address) throw new Error('Wallet not connected')
        const txHash = await write('deposit_funds', [amount], address, signTx)
        return { txHash: txHash ?? '' }
      },
      read: async () => ({ result: undefined as unknown as void }),
    },
    claim_inheritance: {
      invoke: async () => {
        if (!address) throw new Error('Wallet not connected')
        const txHash = await write('claim_inheritance', [], address, signTx)
        return { txHash: txHash ?? '' }
      },
      read: async () => ({ result: undefined as unknown as void }),
    },
    setup_switch: {
      invoke: async (...args: [string, string, string, bigint]) => {
        if (!address) throw new Error('Wallet not connected')
        const txHash = await write('setup_switch', args, address, signTx)
        return { txHash: txHash ?? '' }
      },
      read: async () => ({ result: undefined as unknown as void }),
    },
    get_switch_status: {
      invoke: async () => { throw new Error('Read-only') },
      read: async () => {
        const result = await getSwitchStatus()
        return { result: (result ?? 0) as unknown as bigint }
      },
    },
    get_contract_balance: {
      invoke: async () => { throw new Error('Read-only') },
      read: async () => {
        const result = await getContractBalance()
        return { result: (result ?? 0) as unknown as bigint }
      },
    },
  }

  return contract
}
