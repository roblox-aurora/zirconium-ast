import { CmdSyntaxKind, NodeFlag } from "./Enum";
import {
	NodeBase,
	NodeError,
	StringLiteral,
	NumberLiteral,
	InterpolatedStringExpression,
	BooleanLiteral,
	CommandName,
	CommandStatement,
	InnerExpression,
	CommandSource,
	OperatorToken,
	VariableDeclaration,
	VariableStatement,
	InvalidNode,
	BinaryExpression,
	Node,
	NodeTypes,
	ParentNode,
	VALID_PREFIX_CHARS,
} from "./NodeTypes";
export { CmdSyntaxKind, NodeFlag };

export function hasNodeFlag<F extends NodeFlag>(node: Node, flag: F) {
	return node.flags !== undefined && (node.flags & flag) !== 0;
}

export function createNodeError(message: string, node: Node): NodeError {
	return {
		node,
		message,
	};
}

export interface Option extends NodeBase {
	flag: string;
	right?: Node;
}

export interface PrefixToken extends NodeBase {
	value: typeof VALID_PREFIX_CHARS[number];
}

export interface PrefixExpression extends NodeBase {
	prefix: PrefixToken;
	expression: StringLiteral | NumberLiteral | InterpolatedStringExpression | BooleanLiteral;
}

export interface Identifier extends NodeBase {
	name: string;
}

export interface EndOfStatement extends NodeBase {
	kind: CmdSyntaxKind.EndOfStatement;
}

////////////////////////////////////////////
// Creators
////////////////////////////////////////////

export function createCommandStatement(command: CommandName, children: Node[], startPos?: number, endPos?: number) {
	const statement: CommandStatement = {
		kind: CmdSyntaxKind.CommandStatement,
		command,
		children,
		flags: 0,
		pos: startPos,
		endPos,
	};
	for (const child of statement.children) {
		child.parent = statement;
	}

	return statement;
}

export function createInnerExpression(expression: InnerExpression["expression"], startPos?: number, endPos?: number) {
	const statement: InnerExpression = {
		kind: CmdSyntaxKind.InnerExpression,
		expression,
		flags: 0,
		pos: startPos,
		endPos,
	};
	return statement;
}

export function createPrefixToken(value: PrefixToken["value"]): PrefixToken {
	return { kind: CmdSyntaxKind.PrefixToken, value, flags: 0 };
}

export function createPrefixExpression(
	prefix: PrefixExpression["prefix"],
	expression: PrefixExpression["expression"],
): PrefixExpression {
	return { kind: CmdSyntaxKind.PrefixExpression, prefix, expression, flags: 0 };
}

export function createCommandSource(children: CommandSource["children"]) {
	const statement: CommandSource = { kind: CmdSyntaxKind.Source, children, flags: 0 };
	for (const child of statement.children) {
		child.parent = statement;
	}
	return statement;
}

export function createStringNode(text: string, quotes?: string): StringLiteral {
	return { kind: CmdSyntaxKind.String, text, quotes, flags: 0 };
}

export function createNumberNode(value: number): NumberLiteral {
	return { kind: CmdSyntaxKind.Number, value, flags: 0 };
}

export function createCommandName(name: StringLiteral): CommandName {
	return {
		kind: CmdSyntaxKind.CommandName,
		name,
		flags: 0,
		pos: name.pos,
		endPos: name.endPos,
		rawText: name.rawText,
	};
}

export function createIdentifier(name: string): Identifier {
	return { kind: CmdSyntaxKind.Identifier, name, flags: 0 };
}

export function createOption(flag: string): Option {
	return { kind: CmdSyntaxKind.Option, flag, flags: 0 };
}

export function createOperator(operator: OperatorToken["operator"]): OperatorToken {
	return { kind: CmdSyntaxKind.OperatorToken, operator, flags: 0 };
}

export function createVariableDeclaration(
	identifier: Identifier,
	expression: VariableDeclaration["expression"],
): VariableDeclaration {
	return { kind: CmdSyntaxKind.VariableDeclaration, identifier, expression, flags: 0 };
}

export function createVariableStatement(declaration: VariableDeclaration): VariableStatement {
	return { kind: CmdSyntaxKind.VariableStatement, declaration, flags: 0 };
}

export function createBooleanNode(value: boolean): BooleanLiteral {
	return { kind: CmdSyntaxKind.Boolean, value, flags: 0 };
}

export function createEndOfStatementNode(): EndOfStatement {
	return { kind: CmdSyntaxKind.EndOfStatement, flags: 0 };
}

export function createInvalidNode(
	message: InvalidNode["message"],
	nodes: Node[],
	startPos?: number,
	endPos?: number,
): InvalidNode {
	const firstNode = nodes[0];
	const lastNode = nodes[nodes.size() - 1];

	return {
		kind: CmdSyntaxKind.Invalid,
		message,
		flags: NodeFlag.NodeHasError,
		// eslint-disable-next-line roblox-ts/lua-truthiness
		pos: startPos ?? firstNode.pos,
		// eslint-disable-next-line roblox-ts/lua-truthiness
		endPos: endPos ?? lastNode.endPos,
	};
}

export function createBinaryExpression(
	left: Node,
	op: OperatorToken,
	right: Node,
	startPos?: number,
	endPos?: number,
): BinaryExpression {
	const expression: BinaryExpression = {
		kind: CmdSyntaxKind.BinaryExpression,
		left,
		operator: op,
		right,
		children: [left, right],
		flags: 0,
		pos: startPos,
		endPos,
	};
	left.parent = expression;
	right.parent = expression;
	return expression;
}

/**
 * Flattens an interpolated string into a regular string
 * @param expression The interpolated string expression
 * @param variables The variables for identifiers etc. to flatten with
 */
export function flattenInterpolatedString(
	expression: InterpolatedStringExpression,
	variables: Record<string, defined>,
): StringLiteral {
	let text = "";
	for (const value of expression.values) {
		if (isNode(value, CmdSyntaxKind.Identifier)) {
			text += tostring(variables[value.name]);
		} else {
			text += value.text;
		}
	}
	return { text, kind: CmdSyntaxKind.String, flags: 0 };
}

export function createInterpolatedString(
	...values: InterpolatedStringExpression["values"]
): InterpolatedStringExpression {
	const expression: InterpolatedStringExpression = { kind: CmdSyntaxKind.InterpolatedString, values, flags: 0 };
	for (const value of values) {
		value.parent = expression;
	}
	return expression;
}

export function getSiblingNode(nodes: Node[], kind: CmdSyntaxKind.CommandName): CommandName | undefined;
export function getSiblingNode(nodes: Node[], kind: CmdSyntaxKind) {
	return nodes.find((f) => f.kind === kind);
}

export function offsetNodePosition(node: Node, offset: number) {
	if (node.pos !== undefined && node.endPos !== undefined) {
		node.pos += offset;
		node.endPos += offset;
	}

	if ("children" in node) {
		for (const child of node.children) {
			offsetNodePosition(child, offset);
		}
	} else if ("values" in node) {
		for (const child of node.values) {
			offsetNodePosition(child, offset);
		}
	} else if ("expression" in node) {
		offsetNodePosition(node.expression, offset);
	}
}

export function isNode<K extends keyof NodeTypes>(node: Node, type: K): node is NodeTypes[K] {
	return node !== undefined && node.kind === type;
}

export function assertIsNode<K extends keyof NodeTypes>(node: Node, type: K): asserts node is NodeTypes[K] {
	if (!isNode(node, type)) {
		error(`Expected ${getKindName(type)}, got ${getNodeKindName(node)}`);
	}
}

export function isNodeIn<K extends keyof NodeTypes>(node: Node, type: K[]): node is NodeTypes[K] {
	return node !== undefined && (type as Array<CmdSyntaxKind>).includes(node.kind);
}

export function isParentNode(node: Node): node is ParentNode {
	return "children" in node;
}

export function isValidPrefixCharacter(input: string): input is typeof VALID_PREFIX_CHARS[number] {
	return VALID_PREFIX_CHARS.includes(input as typeof VALID_PREFIX_CHARS[number]);
}

export function getKindName(kind: CmdSyntaxKind | undefined) {
	if (kind === undefined) {
		return "<none>";
	}

	return CmdSyntaxKind[kind];
}

export function getNodeKindName(node: Node) {
	if (node === undefined) {
		return "<none>";
	}

	return getKindName(node.kind);
}

export function getNodesOfType<K extends keyof NodeTypes>(nodes: Node[], type: K): Array<NodeTypes[K]> {
	return nodes.filter((node): node is NodeTypes[K] => isNode(node, type));
}

export function getNextNode(node: Node): Node | undefined {
	const { parent } = node;
	if (parent && isParentNode(parent)) {
		const index = parent.children.indexOf(node) + 1;
		return parent.children[index];
	}
}

export function getPreviousNode(node: Node): Node | undefined {
	const { parent } = node;
	if (parent && isParentNode(parent)) {
		const index = parent.children.indexOf(node) - 1;
		return parent.children[index];
	}
}
