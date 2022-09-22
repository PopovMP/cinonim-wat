'use strict'

const {strictEqual} = require('assert')

const {tokenize, clean} = require('@popovmp/tokenizer')
const {parse}           = require('@popovmp/cinonim-parser')
const {describe, it}    = require('@popovmp/mocha-tiny')

const {astToWat} = require('../index.js')

const src = `
#export-func sub = callSub

int sub(const int a, const int b)
{
	return a - b;
}

int callSub(int a, int b) {
	return sub(a, b);
}
`

const expected = `
(module
    (export "sub" (func $callSub))
    (func $sub (param $a i32) (param $b i32) (result i32)
        (local.get $a) (local.get $b) (i32.sub)
        (return)
    )
    (func $callSub (param $a i32) (param $b i32) (result i32)
        (local.get $a) (local.get $b) (call $sub)
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
