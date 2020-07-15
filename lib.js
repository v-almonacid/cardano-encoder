const cbor = require('cbor')
const bs58 = require('bs58')

const _assert = (value, message, ...args) => {
  if (value) return
  console.error(`Assertion failed: ${message}`, ...args)
  throw new Error(message)
}


/**
 * input: string, hex tx data
 * output: object
 *  {
 *    tx: {
 *      tx: {
 *        inputs: Array<{id: string, index: number}>,
 *        outputs: Array<{address: string, value: number}>,
 *      },
 *      witnesses: Array<{PkWitness: [string, string]}>,
 *    },
 *  }
 */
const decodeRustTx = (rustTxBody) => {
  if (rustTxBody == null) {
    throw new Error('Cannot decode inputs from undefined transaction!')
  }
  const [[[inputs, outputs], witnesses]] = cbor.decodeAllSync(
    Buffer.from(rustTxBody, 'hex'),
  )
  const decInputs = inputs.map((x) => {
    const [[buf, idx]] = cbor.decodeAllSync(x[1].value)
    return {
      id: buf.toString('hex'),
      index: idx,
    }
  })
  const decOutputs = outputs.map((x) => {
    const [addr, val] = x
    return {
      address: bs58.encode(cbor.encode(addr)),
      value: val,
    }
  })
  const decWitnesses = witnesses.map((w) => {
    if (w[0] === 0) {
      return {
        PkWitness: cbor
          .decodeAllSync(w[1].value)[0]
          .map((x) => x.toString('hex')),
      }
    }
    throw Error(`Unexpected witness type: ${w}`)
  })
  return {
    tx: {
      tx: {
        inputs: decInputs,
        outputs: decOutputs,
      },
      witnesses: decWitnesses,
    },
  }
}

/**
 * input: object
 *  {
 *    tx: {
 *      tx: {
 *        inputs: Array<{id: string, index: number}>,
 *        outputs: Array<{address: string, value: number}>,
 *      },
 *      witnesses: Array<{PkWitness: [string, string]}>,
 *    },
 *  }
 * output: Buffer, hex tx data
 */
const encodeTxAsRust = (tx) => {

  const inputs = tx.tx.tx.inputs.map((i) => {
    return [
      0,
      new cbor.Tagged(24, cbor.encode([Buffer.from(i.id, 'hex'), i.index])),
    ]
  })

  const outputs = tx.tx.tx.outputs.map((o) => {
    return [
      cbor.decodeAllSync(bs58.decode(o.address))[0],
      o.value,
    ]
  })

  const witnesses = tx.tx.witnesses.map((w) => {
    return [
      0,
      new cbor.Tagged(24, cbor.encode(w.PkWitness.map((x) => Buffer.from(x, 'hex')))),
    ]
  })
  const normTx = [[inputs, outputs, {}], witnesses]

  // next we change a few CBOR symbols in order to, hopefully, generate
  // exactly the same output that is generated through the rust libs

  let txHex = cbor.encode(normTx).toString('hex').toLowerCase()

  const CBOR_REGEX = /^(8283)(8\d)(8200d8185824[0-9A-Fa-f]{72})+(8\d)(8282d8185821[0-9A-Fa-f]{66}1(a|b)[0-9A-Fa-f]{6,}1(a|b)[0-9A-Fa-f]{6,})+(a)/

  _assert(CBOR_REGEX.test(txHex), 'tx meets CBOR regex')

  // replace opening array tag by indefinite-length tag (9f) for inputs array
  const inputsRegex = /^(8283)(8\d)(8200d8185824)/
  _assert(inputsRegex.test(txHex), 'can locate input array opening tag')
  txHex = txHex.replace(inputsRegex, '$19f$3')

  // add closing tag for inputs array (ff)
  const inputsClosingRegex = /([0-9A-Fa-f]{72})(8\d8282d8185821)/
  _assert(inputsClosingRegex.test(txHex), 'can locate input array closing tag')
  txHex = txHex.replace(inputsClosingRegex, '$1ff$2')

  // do the same for outputs array
  const outputsRegex = /([0-9A-Fa-f]{72}ff)(8\d)(8282d8185821)/
  _assert(outputsRegex.test(txHex), 'can locate output array opening tag')
  txHex = txHex.replace(outputsRegex, '$19f$3')

  const outputsClosingRegex = /(1(?:a|b)[0-9A-Fa-f]{6,})(a081)/
  _assert(outputsClosingRegex.test(txHex), 'can locate output array closing tag')
  txHex = txHex.replace(outputsClosingRegex, '$1ff$2')

  return Buffer.from(txHex, 'hex')
}

exports.encodeTxAsRust = encodeTxAsRust
exports.decodeRustTx = decodeRustTx
