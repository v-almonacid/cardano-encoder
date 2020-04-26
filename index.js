const cbor = require('cbor')
const {Wallet} = require('node-cardano-wallet')
const {encodeTxAsRust, decodeRustTx} = require('./lib')


const wallet = {
  "derivation_scheme": "V2",
  "selection_policy": "FirstMatchFirst",
  "config": {"protocol_magic": 764824073},
  "root_cached_key": "10be4df444be48af3ea3310e45e38a4d53c82400db7a3b91e1a868994db7354de05b7bdfda74bee59f69319aa0b7dd361ddd2e99a6749c123f6872de79bb50bd0cb6c81ecc17963e2e8eb81abf86ca3e7921d44c1992a32493b1a25e6f55e5dd"
}

const inputs = [
  {
    ptr: {
      id:
        '0cd1ec4dce33c7872c3e090c88e9af2fc56c4d7fba6745d15d4fce5e1d4620ba',
      index: 0,
    },
    value: {
      address:
        'Ae2tdPwUPEYxoQwHKy1BEiuFLBtHEAtertUUijFeZMFg9NeaW6N1nWbb7T9',
      value: '5000000',
    },
    addressing: {account: 0, change: 0, index: 0},
  },
]


const outputAddress = 'Ae2tdPwUPEZAghGCdQykbGxc991wdoA8bXmSn7eCGuUKXF4EsRhWj4PJitn'
const changeAddress = 'Ae2tdPwUPEZJcamJUVWxJEwR8rj5x74t3FkUFDzKEdoL8YSyeRdwmJCW9c3'
const outputs = [
  {
    address: outputAddress,
    value: '1509790',
  },
]

async function main() {

  // generate signed tx
  const tx = await Wallet.spend(wallet, inputs, outputs, changeAddress)

  const decodedTx = decodeRustTx(tx.cbor_encoded_tx)
  // console.log(decodedTx.tx.tx)
  // console.log(decodedTx.tx.witnesses)

  const encTx = encodeTxAsRust(decodedTx) 
  // console.log(cbor.encode(encTx).toString('hex'))

  const decodedTx2 = decodeRustTx(encTx.toString('hex'))
  // console.log(decodedTx2.tx.tx)
  // console.log(decodedTx2.tx.witnesses)

  // test
  console.log('********** TESTS **********')
  let result

  console.log('tx bytes should match:')
  result = tx.cbor_encoded_tx === encTx.toString('hex')
  result ?  console.log(result) : console.log('\x1b[41m%s\x1b[0m', result)
  

  console.log('inputs should match:')
  result = inputs[0].ptr.id === decodedTx2.tx.tx.inputs[0].id
  result ?  console.log(result) : console.log('\x1b[41m%s\x1b[0m', result)
}

main()