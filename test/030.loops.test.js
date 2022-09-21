'use strict'

const {strictEqual} = require('assert')

const {tokenize, clean} = require('@popovmp/tokenizer')
const {parse}           = require('@popovmp/cinonim-parser')
const {describe, it}    = require('@popovmp/mocha-tiny')

const {astToWat} = require('../index.js')

const src = `
void forLoop(int j)
{
	int i;
	for (i = 0, j = 0; i < 10; i = i + 1) { j = j + 1; }
	for (i = 0; i > 0; ) { }
	for (i = 0;; i = i + 1) { break; }
	for (i = 0, j = 1; ;i = i + 1, j = j - 1) { break; }
	for (;;) { break; }
}

void doLoop(int i)
{
	do {
		i = i + 1;
	} while (i < 10);
}
`

const expected = `(module

    (func $forLoop (param $j i32)
        (local $i i32)

        (block $return_forLoop

            (local.set $i (i32.const 0))
            (local.set $j (i32.const 0))
            (block $break_3
            (loop  $continue_3
                (br_if $break_3 (i32.eqz (local.get $i) (i32.const 10) (i32.lt_s)))
                (local.set $j (local.get $j) (i32.const 1) (i32.add))
                (local.set $i (local.get $i) (i32.const 1) (i32.add))
                (br $continue_3)
            ))

            (local.set $i (i32.const 0))
            (block $break_3
            (loop  $continue_3
                (br_if $break_3 (i32.eqz (local.get $i) (i32.const 0) (i32.gt_s)))
                (br $continue_3)
            ))

            (local.set $i (i32.const 0))
            (block $break_3
            (loop  $continue_3

                (br $break_3)
                (local.set $i (local.get $i) (i32.const 1) (i32.add))
                (br $continue_3)
            ))

            (local.set $i (i32.const 0))
            (local.set $j (i32.const 1))
            (block $break_3
            (loop  $continue_3

                (br $break_3)
                (local.set $i (local.get $i) (i32.const 1) (i32.add))
                (local.set $j (local.get $j) (i32.const 1) (i32.sub))
                (br $continue_3)
            ))

            (block $break_3
            (loop  $continue_3

                (br $break_3)
                (br $continue_3)
            ))
        )
    )

    (func $doLoop (param $i i32)

        (block $return_doLoop

            (block $break_3
            (loop  $continue_3
                (local.set $i (local.get $i) (i32.const 1) (i32.add))
                (br_if $continue_3 (local.get $i) (i32.const 10) (i32.lt_s))
            ))
        )
    )
)`

const tokens     = tokenize(src)
const cleaned    = clean(tokens)
const moduleNode = parse(cleaned)

describe('loops', () => {
	it('compiles loops to WAT', () => {
		const actual = astToWat(moduleNode)
		strictEqual(actual, expected)
	})
})
