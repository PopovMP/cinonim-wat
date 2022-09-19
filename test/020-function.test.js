'use strict'

const {strictEqual} = require('assert')

const {tokenize, clean} = require('@popovmp/tokenizer')
const {parse}           = require('@popovmp/cinonim-parser')
const {describe, it}    = require('@popovmp/mocha-tiny')

const {astToWat} = require('../index.js')

const src = `
#export-func addTwo = add

int add(int a, int b) {
	return a + b;
}
`

const expected = '' +
`(module
    (export "addTwo" (func $add))
    (func $add (param $a i32) (param $b i32) (result i32)
        (block $_return (result i32)
            (br $_return (local.get $a) (local.get $b) (i32.add))
        )
    )
)`

const tokens     = tokenize(src)
const cleaned    = clean(tokens)
const moduleNode = parse(cleaned)

describe('function', () => {
	it('compiles function to WAT', () => {
		const actual = astToWat(moduleNode)
		strictEqual(actual, expected)
	})
})
