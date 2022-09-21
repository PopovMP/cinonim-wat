'use strict'

const {NodeType, DataType} = require("@popovmp/cinonim-parser")

const operatorMap = {
	'+' : 'add',
	'-' : 'sub',
	'*' : 'mul',
	'/' : 'div',
	'%' : 'rem',
	'<' : 'lt_s',
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
	// #export-func foo = myFoo
	if (node.type === NodeType.exportFunc) {
		const name  = node.value
		const value = node.data[0]

		const wat = `(export "${value}" (func $${name}))`
		output.push( lpad(wat, depth) )
		return
	}

	// Global variable
	// int foo = 42;
	if (node.type === NodeType.globalVar) {
		const name     = node.value
		const dataType = getDataType(node)
		const value    = node.nodes[0].value

		const wat = `(global $${name} (mut ${dataType}) (${dataType}.const ${value}))`
		output.push( lpad(wat, depth) )
		return
	}

	// Global constant
	// const int foo = 42;
	if (node.type === NodeType.globalConst) {
		const name     = node.value
		const dataType = getDataType(node)
		const value    = node.nodes[0].value

		const wat = `(global $${name} ${dataType} (${dataType}.const ${value}))`

		output.push( lpad(wat, depth) )
		return
	}

	// Function definition
	// int foo(int bar, const int baz) { }
	// function
	//   +-- funcParams
	//   \-- funcBody
	if (node.type === NodeType.function) {
		const name       = node.value
		const dataType   = getDataType(node)
		const funcParams = node.nodes[0]
		const funcBody   = node.nodes[1]

		const params = funcParams.nodes.length > 0 ? ' ' +
			funcParams.nodes.map(param => `(param $${param.value} ${getDataType(param)})`).join(' ')
			: ''
		const result = dataType === DataType.void ? '' : ` (result ${dataType})`

		output.push('\n')
		output.push(lpad(`(func $${name}${params}${result}`, depth))

		// Local declaration
		// int foo;
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

	die('Unknown code in module:', node)
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

	// Function return
	// return expression?;}
	if (node.type === NodeType.return) {
		const name  = node.value
		const value = node.nodes.length === 0 ? '' : compileExpression(node.nodes[0])

		output.push('\n')
		output.push( lpad(`(br $return_${name} ${value})`, depth) )
		return
	}

	// break    index?;}
	// continue index?;}
	if (node.type === NodeType.break || node.type === NodeType.condition) {
		const command = node.type === NodeType.break ? 'break' : 'continue'
		const index   = node.value === 0 ? '' : ` (i32.const ${node.value})`
		output.push('\n')
		output.push( lpad(`(br $${command}_${depth-1}${index})`, depth) )
		return
	}

	// for (assignment; condition; assignment) { FORM }
	// for
	//    +-- statement
	//    +-- condition
	//    +-- statement
	//    \-- loopBody
	if (node.type === NodeType.for) {
		output.push('\n')
		const [initNode, condNode, incNode, loopBody] = node.nodes

		for (const assign of initNode.nodes)
			compileAssignment(assign, output, depth)

		output.push( lpad(`(block $break_${depth}`,    depth) )
		output.push( lpad(`(loop  $continue_${depth}`, depth) )

		if (condNode.nodes.length > 0) {
			const predicate = compileExpression(condNode.nodes[0])
			const condition = `(br_if $break_${depth} (i32.eqz ${predicate}))`
			output.push(lpad(condition, depth+1))
		}

		for (const child of loopBody.nodes)
			compileForm(child, output, depth+1)

		for (const assign of incNode.nodes)
			compileAssignment(assign, output, depth+1)

		output.push( lpad(`(br $continue_${depth})`, depth+1) )
		output.push( lpad('))', depth) )
		return
	}

	// do { FORM } while (condition);
	// do
	//    +-- loopBody
	//    \-- condition
	if (node.type === NodeType.do) {
		output.push('\n')
		const [loopBody, condNode] = node.nodes

		output.push( lpad(`(block $break_${depth}`,    depth) )
		output.push( lpad(`(loop  $continue_${depth}`, depth) )

		for (const child of loopBody.nodes)
			compileForm(child, output, depth+1)

		const predicate = compileExpression(condNode.nodes[0])
		const condition = `(br_if $continue_${depth} ${predicate})`
		output.push(lpad(condition, depth+1))

		output.push( lpad('))', depth) )
		return
	}

	// while (condition) { FORM }
	// while
	//    +-- condition
	//    \-- loopBody
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

	// Assignment
	// foo = expression;
	if (node.type === NodeType.localSet || node.type === NodeType.localSet) {
		compileAssignment(node, output, depth)
		return
	}

	die('Unknown code in function:', node)
}

/**
 * Expression
 *
 * @param  {Node} node
 *
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

	die('Unknown code in expression:', node)
}

/**
 * @param {Node} node
 * @param {string[]} output
 * @param {number} depth
 */
function compileAssignment(node, output, depth)
{
	const scope = node.type === NodeType.localSet ? 'local' : 'global'
	const name  = node.value
	const expr  = compileExpression(node.nodes[0])

	output.push( lpad(`(${scope}.set $${name} ${expr})`, depth) )
}

/**
 * Gets data type
 *
 * @param {Node} node
 *
 * @return {string}
 */
function getDataType(node)
{
	switch (node.dataType) {
		case DataType.f32 : return 'f32'
		case DataType.f64 : return 'f64'
		case DataType.i32 : return 'i32'
		case DataType.i64 : return 'i64'
		case DataType.void: return DataType.void
	}

	die('Unknown data type:', node)
}

/**
 * Throws error
 *
 * @param {string} message
 * @param {Node} node
 */
function die(message, node)
{
	const t1 = node.token
	const dataType = node.dataType === DataType.na ? '' : `: ${node.dataType}`
	const value    = node.value    === '' ? '' : ` ${node.value}`
	throw new Error(`[${t1.line + 1}, ${t1.column + 1}] ${message} "${node.type}"${dataType}${value}`)
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
