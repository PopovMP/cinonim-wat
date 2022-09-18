'use strict'

const {strictEqual} = require('assert')

const {tokenize, clean} = require('@popovmp/tokenizer')
const {parse}           = require('@popovmp/cinonim-parser')
const {describe, it}    = require('@popovmp/mocha-tiny')

const {astToWat} = require('../index.js')

const src = `
double multiply(double a, double b) {
	return a * b;
}
`

const expected = '' +
`(module
    (func $multiply (param $a f64) (param $b f64) (result f64)
        (block $_return  (result f64)
            (br $_return (f64.mul (local.get $a) (local.get $b)))
        )
    )
)`

const tokens     = tokenize(src)
const cleaned    = clean(tokens)
const moduleNode = parse(cleaned)

describe('compile global vars', () => {
	it('global vars', () => {
		const actual = astToWat(moduleNode)
		strictEqual(actual, expected)
	})
})
