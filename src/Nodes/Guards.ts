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
} from "./NodeTypes";
import { NodeFlag, CmdSyntaxKind } from "./Enum";
import { getKindName, getNodeKindName } from "./Functions";

export function isNode<K extends keyof NodeTypes>(node: Node, type: K): node is NodeTypes[K] {
	return node !== undefined && node.kind === type;
}

export function hasNodeFlag<F extends NodeFlag>(node: Node, flag: F) {
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

export function getSiblingNode(nodes: Node[], kind: CmdSyntaxKind.CommandName): CommandName | undefined;
export function getSiblingNode(nodes: Node[], kind: CmdSyntaxKind) {
	return nodes.find((f) => f.kind === kind);
}

export function isNodeIn<K extends keyof NodeTypes>(node: Node, type: readonly K[]): node is NodeTypes[K] {
	return node !== undefined && (type as ReadonlyArray<CmdSyntaxKind>).includes(node.kind);
}

export function isValidPrefixCharacter(input: string): input is typeof VALID_PREFIX_CHARS[number] {
	return VALID_PREFIX_CHARS.includes(input as typeof VALID_PREFIX_CHARS[number]);
}

const PREFIXABLE = [
	CmdSyntaxKind.String,
	CmdSyntaxKind.InterpolatedString,
	CmdSyntaxKind.Number,
	CmdSyntaxKind.Boolean,
] as const;

/**
 * Can this expression be prefixed?
 */
export function isPrefixableExpression(node: Node): node is NodeTypes[typeof PREFIXABLE[number]] {
	return isNodeIn(node, PREFIXABLE);
}

const ASSIGNABLE = [
	CmdSyntaxKind.String,
	CmdSyntaxKind.InterpolatedString,
	CmdSyntaxKind.Identifier,
	CmdSyntaxKind.Number,
	CmdSyntaxKind.Boolean,
	CmdSyntaxKind.InnerExpression,
] as const;

/**
 * Can this expression be prefixed?
 */
export function isAssignableExpression(node: Node): node is NodeTypes[typeof ASSIGNABLE[number]] {
	return isNodeIn(node, ASSIGNABLE);
}

const EXPRESSIONABLE = [
	CmdSyntaxKind.CommandStatement,
	CmdSyntaxKind.VariableStatement,
	CmdSyntaxKind.BinaryExpression,
] as const;

/**
 * Can this expression be prefixed?
 */
export function isValidExpression(node: Node): node is NodeTypes[typeof EXPRESSIONABLE[number]] {
	return isNodeIn(node, EXPRESSIONABLE);
}

export function isSource(node: Node): node is CommandSource {
	return node !== undefined && node.kind === CmdSyntaxKind.Source;
}

export function isCommandStatement(node: Node): node is CommandStatement {
	return node !== undefined && node.kind === CmdSyntaxKind.CommandStatement;
}

export function isVariableStatement(node: Node): node is VariableStatement {
	return node !== undefined && node.kind === CmdSyntaxKind.VariableStatement;
}

export function isIdentifier(node: Node): node is Identifier {
	return node !== undefined && node.kind === CmdSyntaxKind.Identifier;
}

export function isStringLiteral(node: Node): node is StringLiteral {
	return node !== undefined && node.kind === CmdSyntaxKind.String;
}

export function isPrefixToken(node: Node): node is PrefixToken {
	return node !== undefined && node.kind === CmdSyntaxKind.PrefixToken;
}

export function isOperatorToken(node: Node): node is OperatorToken {
	return node !== undefined && node.kind === CmdSyntaxKind.OperatorToken;
}

export function isInvalid(node: Node): node is InvalidNode {
	return node !== undefined && node.kind === CmdSyntaxKind.Invalid;
}
