'use strict'

const {strictEqual} = require('assert')

const {tokenize, clean} = require('@popovmp/tokenizer')
const {parse}           = require('@popovmp/cinonim-parser')
const {describe, it}    = require('@popovmp/mocha-tiny')

const {astToWat} = require('../index.js')

const src = `
#export-func fibonacci = fibonacci

long fibonacci(int n)
{
	long curr, prev, temp;

	curr = 1L;
	prev = 1L;

	while(n > 2) {
		temp = curr;
		curr = prev + curr;
		prev = temp;
		n    = n - 1;
	}

	return curr;
}
`

const expected =
`(module
    (export "fibonacci" (func $fibonacci))

    (func $fibonacci (param $n i32) (result i64)
        (local $curr i64)
        (local $prev i64)
        (local $temp i64)

        (block $return_fibonacci (result i64)
            (local.set $curr (i64.const 1))
            (local.set $prev (i64.const 1))

            (block $break_3
            (loop  $continue_3
                (br_if $break_3 (i32.eqz (local.get $n) (i32.const 2) (i32.gt_s)))
                (local.set $temp (local.get $curr))
                (local.set $curr (local.get $prev) (local.get $curr) (i64.add))
                (local.set $prev (local.get $temp))
                (local.set $n (local.get $n) (i32.const 1) (i32.sub))
                (br $continue_3)
            ))

            (br $return_fibonacci (local.get $curr))
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
