const cbor = require('cbor')
const bs58 = require('bs58')


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
  return cbor.encode(normTx)
}

exports.encodeTxAsRust = encodeTxAsRust
exports.decodeRustTx = decodeRustTx