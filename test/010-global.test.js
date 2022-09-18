'use strict'

const {strictEqual} = require('assert')

const {tokenize, clean} = require('@popovmp/tokenizer')
const {parse}           = require('@popovmp/cinonim-parser')
const {describe, it}    = require('@popovmp/mocha-tiny')

const {astToWat} = require('../index.js')

const src = `
double foo = 3.14;
long   bar = 42;
const float baz = 1.2F;
`

const expected = `(module
    (global $foo (mut f64) (f64.const 3.14))
    (global $bar (mut i64) (i64.const 42))
    (global $baz f32 (f32.const 1.2))
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
