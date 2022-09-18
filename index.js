'use strict'

const {NodeType}  = require("@popovmp/cinonim-parser")

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

	walkAst(moduleNode, output)

	return output.join('')
}

/**
 *
 * @param {Node} parentNode
 * @param {string[]} output
 */
function walkAst(parentNode, output)
{

	if (parentNode.type === NodeType.module) {
		output.push('(module')

		for (const node of parentNode.nodes)
			walkAst(node, output)

		output.push(')')
	}
}



module.exports = {
	astToWat
}
