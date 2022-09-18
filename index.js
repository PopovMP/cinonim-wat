'use strict'

const {NodeType, DataType} = require("@popovmp/cinonim-parser")

/**
 * Compile Cinonim AST to WAT
 *
 * @param {Node} moduleNode
 *
 * @return {string}
 */
function astToWat(moduleNode)
{
	const output = []

	walkAst(moduleNode, output, 0)

	return output.join('')
}

/**
 *
 * @param {Node} node
 * @param {string[]} output
 * @param {number} depth
 */
function walkAst(node, output, depth)
{
	// Module
	if (node.type === NodeType.module) {
		output.push('(module')

		if (node.nodes.length > 0) {
			output.push('\n')

			for (const child of node.nodes)
				walkAst(child, output, depth + 1)
		}

		output.push(')')
	}

	// Global var
	if (node.type === NodeType.globalVar) {
		const name     = node.value
		const dataType = getDataType(node)
		const value    = node.nodes[0].value

		const wat = `(global $${name} (mut ${dataType}) (${dataType}.const ${value}))`
		output.push( lpad(wat, depth) )
	}

	// Global const
	if (node.type === NodeType.globalConst) {
		const name     = node.value
		const dataType = getDataType(node)
		const value    = node.nodes[0].value

		const wat = `(global $${name} ${dataType} (${dataType}.const ${value}))`

		output.push( lpad(wat, depth) )
	}

}

/**
 * Gets data type
 * @param {Node} node
 * @return {string}
 */
function getDataType(node)
{
	switch (node.dataType) {
		case DataType.f32: return 'f32'
		case DataType.f64: return 'f64'
		case DataType.i32: return 'i32'
		case DataType.i64: return 'i64'
	}

	throw new Error('Unknown data type: ' + node.dataType)
}

/**
 * Gets left pad
 *
 * @param {string} wat
 * @param {number} depth
 *
 * @return {string}
 */
function lpad(wat, depth)
{
	return '    '.repeat(depth) + wat + '\n'
}


module.exports = {
	astToWat
}
