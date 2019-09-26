import { NowRequest, NowResponse } from '@now/node'
import faunadb from 'faunadb'

import { AddressDocument } from '../../constants'
import { validatePermissionString } from '../../utils'

const client = new faunadb.Client({
  secret: process.env.FAUNADB_SERVER_SECRET
})
const q = faunadb.query

export default async function(req: NowRequest, res: NowResponse): Promise<NowResponse> {
  const { body } = req
  const { address, signature, scannedAddress } = JSON.parse(body || JSON.stringify({}))

  if (!address || !signature || !scannedAddress) {
    return res.status(400).send('')
  }

  if (address === scannedAddress) {
    return res.status(400).send('')
  }

  if (!validatePermissionString(address, signature)) {
    return res.status(401).send('')
  }

  try {
    const addressData: any = await client.query(
      q.Map(q.Paginate(q.Match(q.Index('by-address_addresses'), address)), (ref): any => q.Get(ref))
    )

    if (addressData.data.length === 0) {
      return res.status(401).send('')
    }

    const addressDocument: AddressDocument = addressData.data[0].data

    if (addressDocument.boostsLeft === 0) {
      return res.status(401).send('')
    }

    // faucet both here
    // await Promise.all([
    //   unipigWallet.rollup.requestFaucetFunds(address, 1000),
    //   unipigWallet.rollup.requestFaucetFunds(scannedAddress, 1000)
    // ])

    // all has gone well, update db
    await client.query(
      q.Update(q.Ref(q.Collection('addresses'), addressData.data[0].id), {
        data: {
          boostsLeft: addressDocument.boostsLeft - 1
        }
      })
    )

    return res.status(200).send('')
  } catch (error) {
    console.error(error)
    return res.status(500).send('An unknown error occurred.')
  }
}
