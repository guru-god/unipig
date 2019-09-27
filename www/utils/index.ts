import Cookies from 'js-cookie'
import nextCookies from 'next-cookies'
import { verifyMessage } from '@ethersproject/wallet'
import { defaultAbiCoder } from '@ethersproject/abi'
import fetch from 'isomorphic-unfetch'
import { BigNumber } from '@uniswap/sdk'
import { UNI_TOKEN_TYPE, PIGI_TOKEN_TYPE } from '@pigi/wallet'
import uuid from 'uuid/v4'

import { COOKIE_NAME, Cookie, Team } from '../contexts/Client'
import { FAUCET_TIMEOUT, FAUCET_AMOUNT, AddressDocument, WalletSource } from '../constants'

export function getPermissionString(address: string): string {
  return `Proof of ownership over ${address}, provided to https://unipig.exchange.`
}

export function validatePermissionString(address: string, signature: string): boolean {
  const permissionString = getPermissionString(address)

  try {
    const signingAddress = verifyMessage(permissionString, signature)
    return signingAddress === address
  } catch {
    return false
  }
}

export function formatCookie(o: object): string {
  const stringified = JSON.stringify(o || {})
  const base64 = Buffer.from(stringified).toString('base64')
  return base64
}

function parseCookie(s: string): Cookie {
  const stringified = Buffer.from(s || '', 'base64').toString()
  const asObject = JSON.parse(stringified || JSON.stringify({}))
  return asObject
}

function getCookieServer(context: any): string {
  return nextCookies(context)[COOKIE_NAME]
}

function getCookieClient(): string {
  return Cookies.get(COOKIE_NAME)
}

export function getCookie(serverSide: boolean, context?: any): Cookie {
  return parseCookie(serverSide ? getCookieServer(context) : getCookieClient())
}

export function truncateAddress(address: string, length: number): string {
  return `${address.substring(0, length + 2)}...${address.substring(address.length - length, address.length)}`
}

// from https://github.com/zeit/next.js/blob/canary/examples/with-cookie-auth/utils/get-host.js
// This is not production ready, (except with providers that ensure a secure host, like Now)
// For production consider the usage of environment variables and NODE_ENV
export function getHost(req: any): string {
  if (!req) {
    return ''
  }

  const { host } = req.headers

  if (host.startsWith('localhost')) {
    return `http://${host}`
  }

  return `https://${host}`
}

export function addressSource(document: AddressDocument): WalletSource {
  return document.paperWallet
    ? WalletSource.PAPER
    : document.lastTwitterFaucet > 0
    ? WalletSource.TWITTER
    : WalletSource.GENERATED
}

export function canFaucet(document: AddressDocument): boolean {
  return document.lastTwitterFaucet + FAUCET_TIMEOUT < Date.now()
}

export async function swap(OVMWallet: any, address: string, inputToken: Team, inputAmount: BigNumber): Promise<void> {
  const tokenType = inputToken === Team.UNI ? UNI_TOKEN_TYPE : PIGI_TOKEN_TYPE
  await OVMWallet.swap(tokenType, address, inputAmount.toNumber(), 0, Date.now() + 10000)
}

export async function send(OVMWallet: any, from: string, to: string, token: Team, amount: BigNumber): Promise<void> {
  const tokenType = token === Team.UNI ? UNI_TOKEN_TYPE : PIGI_TOKEN_TYPE
  await OVMWallet.send(tokenType, from, to, amount.toNumber())
}

export function getFaucetData(address: string): string {
  return defaultAbiCoder.encode(['address', 'uint256'], [address, FAUCET_AMOUNT])
}

export async function faucet(recipient: string, signature: string): Promise<void> {
  await fetch(process.env.AGGREGATOR_URL, {
    method: 'POST',
    body: JSON.stringify({
      id: uuid(),
      jsonrpc: '2.0',
      method: 'requestFaucetFunds',
      params: [
        {
          signature,
          transaction: {
            sender: recipient,
            amount: FAUCET_AMOUNT
          }
        }
      ]
    })
  }).then((response): void => {
    if (!response.ok) {
      throw Error(`${response.status} Error: ${response.statusText}`)
    }
  })
}
