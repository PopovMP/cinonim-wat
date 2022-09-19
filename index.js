'use strict'

const {NodeType, DataType} = require("@popovmp/cinonim-parser")

const operatorMap = {
	'+' : 'add',
	'-' : 'sub',
	'*' : 'mul',
	'/' : 'div',
	'%' : 'rem',
	'<' : 'lt_S',
	'<=': 'le_s',
	'>' : 'gt_s',
	'>=': 'ge_s',
	'==': 'eq',
	'!=': 'ne',
}

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
		return
	}

	// Export function
	if (node.type === NodeType.exportFunc) {
		const name  = node.value
		const value = node.data[0]

		const wat = `(export "${value}" (func $${name}))`
		output.push( lpad(wat, depth) )
		return
	}

	// Global var
	if (node.type === NodeType.globalVar) {
		const name     = node.value
		const dataType = getDataType(node)
		const value    = node.nodes[0].value

		const wat = `(global $${name} (mut ${dataType}) (${dataType}.const ${value}))`
		output.push( lpad(wat, depth) )
		return
	}

	// Global const
	if (node.type === NodeType.globalConst) {
		const name     = node.value
		const dataType = getDataType(node)
		const value    = node.nodes[0].value

		const wat = `(global $${name} ${dataType} (${dataType}.const ${value}))`

		output.push( lpad(wat, depth) )
		return
	}

	// Function
	if (node.type === NodeType.function) {
		const name       = node.value
		const dataType   = getDataType(node)
		const funcParams = node.nodes[0]
		const funcBody   = node.nodes[1]

		const params = funcParams.nodes.map( param => `(param $${param.value} ${getDataType(param)})`).join(' ')
		const result = dataType === DataType.void ? '' : ` (result ${dataType})`

		output.push('\n')
		output.push(lpad(`(func $${name} ${params}${result}`, depth))

		// Local vars
		for (const child of funcBody.nodes) {
			if (child.type !== NodeType.localVar) break
			output.push( lpad(`(local $${child.value} ${getDataType(child)})`, depth+1) )
		}

		output.push('\n')
		output.push(lpad(`(block $return_${name}${result}`, depth+1))

		for (const child of funcBody.nodes)
			compileForm(child, output, depth+2)

		output.push( lpad(')', depth+1) )
		output.push( lpad(')', depth) )
		return
	}

	throw new Error('Unknown code at module: ' + node.value)
}

/**
 * @param {Node} node
 * @param {string[]} output
 * @param {number} depth
 */
function compileForm(node, output, depth)
{
	// Local are compiled before the function's return block
	if (node.type === NodeType.localVar) return

	// Local set
	if (node.type === NodeType.localSet) {
		const name = node.value
		const expr = compileExpression(node.nodes[0])

		const wat = `(local.set $${name} ${expr})`

		output.push( lpad(wat, depth) )
		return
	}

	// Global set
	if (node.type === NodeType.localSet) {
		const name = node.value
		const expr = compileExpression(node.nodes[0])

		const wat = `(global.set $${name} ${expr})`

		output.push( lpad(wat, depth) )
		return
	}

	// While
	if (node.type === NodeType.while) {
		output.push('\n')
		output.push( lpad(`(block $break_${depth}`,    depth) )
		output.push( lpad(`(loop  $continue_${depth}`, depth) )

		const predicate = compileExpression(node.nodes[0].nodes[0])
		const condition = `(br_if $break_${depth} (i32.eqz ${predicate}))`
		output.push( lpad(condition, depth+1) )

		for (const child of node.nodes[1].nodes)
			compileForm(child, output, depth+1)

		output.push( lpad(`(br $continue_${depth})`, depth+1) )
		output.push( lpad('))', depth) )

		return
	}

	// return
	if (node.type === NodeType.return) {
		const name  = node.value
		const value = node.nodes.length === 0 ? '' : compileExpression(node.nodes[0])

		output.push('\n')
		output.push( lpad(`(br $return_${name} ${value})`, depth) )
		return
	}

	throw new Error('Unknown code at function: ' + node.value)
}

/**
 *
 * @param  {Node} node
 * @return {string}
 */
function compileExpression(node)
{
	if (node.type === NodeType.expression) {
		return node.nodes.map(n => compileExpression(n)).join(' ')
	}

	if (node.type === NodeType.number) {
		const dataType = getDataType(node)
		const value    = node.value

		return `(${dataType}.const ${value})`
	}

	if (node.type === NodeType.localGet) {
		const name = node.value
		return `(local.get $${name})`
	}

	if (node.type === NodeType.globalGet) {
		const name = node.value
		return `(global.get $${name})`
	}

	if (node.type === NodeType.operator) {
		const dataType    = getDataType(node)
		const instruction = operatorMap[node.value]

		return `(${dataType}.${instruction})`
	}

	throw new Error('Unknown code in expression: ' + node.value)
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
 * @param {boolean} nl
 *
 * @return {string}
 */
function lpad(wat, depth, nl = true)
{
	return '    '.repeat(depth) + wat + (nl ? '\n' : '')
}


module.exports = {
	astToWat
}
