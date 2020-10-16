import {
	NodeTypes,
	Node,
	VALID_PREFIX_CHARS,
	CommandName,
	CommandStatement,
	VariableStatement,
	StringLiteral,
	InvalidNode,
	CommandSource,
	PrefixToken,
	OperatorToken,
	Identifier,
	Option,
	InterpolatedStringExpression,
	NumberLiteral,
	BooleanLiteral,
	BinaryExpression,
} from "./NodeTypes";
import { ZrNodeFlag, ZrNodeKind } from "./Enum";
import { getKindName, getNodeKindName } from "./Functions";

export function isNode<K extends keyof NodeTypes>(node: Node, type: K): node is NodeTypes[K] {
	return node !== undefined && node.kind === type;
}

export function hasNodeFlag<F extends ZrNodeFlag>(node: Node, flag: F) {
	return node.flags !== undefined && (node.flags & flag) !== 0;
}

export function assertIsNode<K extends keyof NodeTypes>(node: Node, type: K): asserts node is NodeTypes[K] {
	if (!isNode(node, type)) {
		error(`Expected ${getKindName(type)}, got ${getNodeKindName(node)}`);
	}
}

export function getNodesOfType<K extends keyof NodeTypes>(nodes: Node[], type: K): Array<NodeTypes[K]> {
	return nodes.filter((node): node is NodeTypes[K] => isNode(node, type));
}

export function getSiblingNode(nodes: Node[], kind: ZrNodeKind.CommandName): CommandName | undefined;
export function getSiblingNode(nodes: Node[], kind: ZrNodeKind) {
	return nodes.find((f) => f.kind === kind);
}

export function isNodeIn<K extends keyof NodeTypes>(node: Node, type: readonly K[]): node is NodeTypes[K] {
	return node !== undefined && (type as ReadonlyArray<ZrNodeKind>).includes(node.kind);
}

export function isValidPrefixCharacter(input: string): input is typeof VALID_PREFIX_CHARS[number] {
	return VALID_PREFIX_CHARS.includes(input as typeof VALID_PREFIX_CHARS[number]);
}

export const VALID_VARIABLE_NAME = "^[A-Za-z_][A-Za-z0-9_]*$"; // matches $A, $a, $a0, $_a, $A_, $A_a, etc.
export const VALID_COMMAND_NAME = "^[A-Za-z][A-Z0-9a-z_%-]*$";

const PREFIXABLE = [ZrNodeKind.String, ZrNodeKind.InterpolatedString, ZrNodeKind.Number, ZrNodeKind.Boolean] as const;

/**
 * Can this expression be prefixed?
 */
export function isPrefixableExpression(node: Node): node is NodeTypes[typeof PREFIXABLE[number]] {
	return isNodeIn(node, PREFIXABLE);
}

export const ASSIGNABLE = [
	ZrNodeKind.String,
	ZrNodeKind.InterpolatedString,
	ZrNodeKind.Identifier,
	ZrNodeKind.Number,
	ZrNodeKind.Boolean,
	ZrNodeKind.InnerExpression,
	ZrNodeKind.ArrayLiteralExpression,
	ZrNodeKind.PropertyAccessExpression,
	ZrNodeKind.ArrayIndexExpression,
	ZrNodeKind.ObjectLiteralExpression,
	ZrNodeKind.CommandStatement,
	ZrNodeKind.BinaryExpression,
] as const;

/**
 * Can this expression be prefixed?
 */
export function isAssignableExpression(node: Node): node is NodeTypes[typeof ASSIGNABLE[number]] {
	return isNodeIn(node, ASSIGNABLE);
}

const LIT = [
	ZrNodeKind.String,
	ZrNodeKind.InterpolatedString,
	ZrNodeKind.Identifier,
	ZrNodeKind.Number,
	ZrNodeKind.Boolean,
] as const;

/**
 * Is this expression considered a primitive type?
 */
export function isPrimitiveExpression(node: Node): node is NodeTypes[typeof LIT[number]] {
	return isNodeIn(node, ASSIGNABLE);
}

const EXPRESSIONABLE = [
	ZrNodeKind.CommandStatement,
	ZrNodeKind.VariableStatement,
	ZrNodeKind.BinaryExpression,
] as const;

/**
 * Can this expression be prefixed?
 */
export function isValidExpression(node: Node): node is NodeTypes[typeof EXPRESSIONABLE[number]] {
	return isNodeIn(node, EXPRESSIONABLE);
}

export function isSource(node: Node): node is CommandSource {
	return node !== undefined && node.kind === ZrNodeKind.Source;
}

export function isCommandStatement(node: Node): node is CommandStatement {
	return node !== undefined && node.kind === ZrNodeKind.CommandStatement;
}

export function isVariableStatement(node: Node): node is VariableStatement {
	return node !== undefined && node.kind === ZrNodeKind.VariableStatement;
}

export function isIdentifier(node: Node): node is Identifier {
	return node !== undefined && node.kind === ZrNodeKind.Identifier;
}

export function isStringExpression(node: Node): node is StringLiteral | InterpolatedStringExpression {
	return node !== undefined && (node.kind === ZrNodeKind.String || node.kind === ZrNodeKind.InterpolatedString);
}

export function isBooleanLiteral(node: Node): node is BooleanLiteral {
	return node !== undefined && node.kind === ZrNodeKind.Boolean;
}

export function isNumberLiteral(node: Node): node is NumberLiteral {
	return node !== undefined && node.kind === ZrNodeKind.Number;
}

export function isStringLiteral(node: Node): node is StringLiteral {
	return node !== undefined && node.kind === ZrNodeKind.String;
}

export function isPrefixToken(node: Node): node is PrefixToken {
	return node !== undefined && node.kind === ZrNodeKind.PrefixToken;
}

export function isOperatorToken(node: Node): node is OperatorToken {
	return node !== undefined && node.kind === ZrNodeKind.OperatorToken;
}

export function isBinaryExpression(node: Node): node is BinaryExpression {
	return node !== undefined && node.kind === ZrNodeKind.BinaryExpression;
}

export function isOptionKey(node: Node): node is Option {
	return node !== undefined && node.kind === ZrNodeKind.OptionKey;
}

export function isInvalid(node: Node): node is InvalidNode {
	return node !== undefined && node.kind === ZrNodeKind.Invalid;
}
