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
	'&&': 'and',
	'||': 'or',
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

	compileAst(moduleNode, output, 0)

	return output.join('')
}

/**
 * @param {Node}     node
 * @param {string[]} output
 * @param {number}   depth
 */
function compileAst(node, output, depth)
{
	// Module
	if (node.type === NodeType.module) {
		output.push('(module')

		if (node.nodes.length > 0) {
			output.push('\n')
			for (const child of node.nodes)
				compileAst(child, output, depth + 1)
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
		const dataType = node.dataType
		const value    = node.nodes[0].value

		const wat = `(global $${name} (mut ${dataType}) (${dataType}.const ${value}))`
		output.push( lpad(wat, depth) )
		return
	}

	// Global constant
	// const int foo = 42;
	if (node.type === NodeType.globalConst) {
		const name     = node.value
		const dataType = node.dataType
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
		const dataType   = node.dataType
		const funcParams = node.nodes[0]
		const funcBody   = node.nodes[1]

		const params = funcParams.nodes.length > 0 ? ' ' +
			funcParams.nodes.map(param => `(param $${param.value} ${param.dataType})`).join(' ')
			: ''
		const result = dataType === DataType.void ? '' : ` (result ${dataType})`

		output.push(lpad(`(func $${name}${params}${result}`, depth))

		// Local declaration
		// int foo;
		for (const child of funcBody.nodes) {
			if (child.type !== NodeType.localVar) break
			output.push( lpad(`(local $${child.value} ${child.dataType})`, depth+1) )
		}

		for (const child of funcBody.nodes)
			compileForm(child, output, depth+1)

		output.push( lpad(')', depth) )
		return
	}

	die('Unknown code in module:', node)
}

/**
 * @param {Node}     node
 * @param {string[]} output
 * @param {number}   depth
 */
function compileForm(node, output, depth)
{
	// Local are compiled before the function's return block
	if (node.type === NodeType.localVar) return

	// Function return
	// return expression?;}
	if (node.type === NodeType.return) {
		if (node.nodes.length === 1) {
			const value = compileExpression(node.nodes[0])
			output.push( lpad(value, depth) )
		}
		output.push( lpad(`(return)`, depth) )
		return
	}

	// break    index?;}
	// continue index?;}
	if (node.type === NodeType.break || node.type === NodeType.condition) {
		const command = node.type === NodeType.break ? 'break' : 'continue'
		const index   = node.value === 0 ? '' : ` (i32.const ${node.value})`
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
		const [initNode, condNode, incNode, loopBody] = node.nodes

		for (const assign of initNode.nodes)
			compileAssignment(assign, output, depth)

		output.push( lpad(`(block $break_${   depth}`, depth) )
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
		const [loopBody, condNode] = node.nodes

		output.push( lpad(`(block $break_${   depth}`, depth) )
		output.push( lpad(`(loop  $continue_${depth}`, depth) )

		for (const child of loopBody.nodes)
			compileForm(child, output, depth+1)

		const predicate = compileExpression(condNode.nodes[0])
		const condition = `(br_if $continue_${depth} ${predicate})`
		output.push( lpad(condition, depth+1) )

		output.push( lpad('))', depth) )
		return
	}

	// while (condition) { FORM }
	// while
	//    +-- condition
	//    \-- loopBody
	if (node.type === NodeType.while) {
		const [condNode, loopBody] = node.nodes

		output.push( lpad(`(block $break_${   depth}`, depth) )
		output.push( lpad(`(loop  $continue_${depth}`, depth) )

		const predicate = compileExpression(condNode.nodes[0])
		const condition = `(br_if $break_${depth} (i32.eqz ${predicate}))`
		output.push( lpad(condition, depth+1) )

		for (const child of loopBody.nodes)
			compileForm(child, output, depth+1)

		output.push( lpad(`(br $continue_${depth})`, depth+1) )
		output.push( lpad('))', depth) )
		return
	}

	// if (condition) { FORM }
	// if (condition) { FORM } else { FORM }
	// if
	//    +-- condition
	//    +-- then
	//    \-- else
	if (node.type === NodeType.if) {
		const [condNode, thenNode, elseNode] = node.nodes

		const predicate = compileExpression(condNode.nodes[0])
		output.push( lpad(predicate, depth) )
		output.push( lpad(`(if (then`, depth) )

		for (const child of thenNode.nodes)
			compileForm(child, output, depth+1)

		if (elseNode) {
			output.push( lpad(`)(else`, depth) )
			for (const child of thenNode.nodes)
				compileForm(child, output, depth+1)
		}

		output.push( lpad(`))`, depth) )
		return;
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
 * Compiles an expression and returns WAT string
 *
 * @param  {Node} node
 *
 * @return {string}
 */
function compileExpression(node)
{
	switch (node.type) {
		case NodeType.expression:
			return node.nodes.map(n => compileExpression(n)).join(' ')
		case NodeType.number:
			return `(${node.dataType}.const ${node.value})`
		case NodeType.localGet:
			return `(local.get $${node.value})`
		case NodeType.globalGet:
			return `(global.get $${node.value})`
		case NodeType.operator:
			return `(${node.dataType}.${operatorMap[node.value]})`
		default:
			die('Unknown code in expression:', node)
	}
}

/**
 * Compiles a variable assignment
 *
 * @param {Node}     node
 * @param {string[]} output
 * @param {number}   depth
 *
 * @return {void}
 */
function compileAssignment(node, output, depth)
{
	const scope = node.type === NodeType.localSet ? 'local' : 'global'
	const name  = node.value
	const expr  = compileExpression(node.nodes[0])

	output.push( lpad(`(${scope}.set $${name} ${expr})`, depth) )
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

/**
 * Throws error
 *
 * @param {string} message
 * @param {Node} node
 */
function die(message, node)
{
	const token    = node.token
	const dataType = node.dataType === DataType.na ? '' : `: ${node.dataType}`
	const value    = node.value    === '' ? '' : ` ${node.value}`
	throw new Error(`[${token.line + 1}, ${token.column + 1}] ${message} "${node.type}"${dataType}${value}`)
}

module.exports = {
	astToWat
}
