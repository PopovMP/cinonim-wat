'use strict'

const {strictEqual} = require('assert')

const {tokenize, clean} = require('@popovmp/tokenizer')
const {parse}           = require('@popovmp/cinonim-parser')
const {describe, it}    = require('@popovmp/mocha-tiny')

const {astToWat} = require('../index.js')

const src = `
int absAdd(int a, int b) {
	int sum;
	sum = a + b;

	if (sum < 0) {
		return 0 - sum;
	}
	
	return sum;
}
`

const expected = `
(module
    (func $absAdd (param $a i32) (param $b i32) (result i32)
        (local $sum i32)
        (local.set $sum (local.get $a) (local.get $b) (i32.add))
        (local.get $sum) (i32.const 0) (i32.lt_s)
        (if (then
            (i32.const 0) (local.get $sum) (i32.sub)
            (return)
        ))
        (local.get $sum)
        (return)
    )
)
`

describe('function', () => {
	it('compiles function to WAT', () => {
		const actual = '\n' + astToWat(parse(clean(tokenize(src)))) + '\n'
		strictEqual(actual, expected)
	})
})
