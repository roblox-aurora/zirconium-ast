export enum CmdSyntaxKind {
	Unknown,
	Source,
	CommandStatement,
	InnerExpression,
	String,
	Boolean,
	CommandName,
	Number,
	Option,
	Identifier,
	OperatorToken,
	BinaryExpression,
	InterpolatedString,
	PrefixToken,
	PrefixExpression,
	EndOfStatement,
	VariableDeclaration,
	VariableStatement,
	Invalid,
}

export const enum NodeFlag {
	None = 0,
	NodeHasError = 1 << 16,
}

export function hasNodeFlag<F extends NodeFlag>(node: Node, flag: F) {
	return node.flags !== undefined && (node.flags & flag) !== 0;
}

interface NodeBase {
	kind: CmdSyntaxKind;
	parent?: Node;
	pos?: number;
	rawText?: string;
	endPos?: number;
	flags: NodeFlag;
}

type OP = "&&" | "|" | "=";

export interface OperatorToken extends NodeBase {
	operator: OP;
	kind: CmdSyntaxKind.OperatorToken;
}

export interface CommandSource extends NodeBase {
	kind: CmdSyntaxKind.Source;
	children: Array<Node>;
}

export interface InterpolatedStringExpression extends NodeBase {
	kind: CmdSyntaxKind.InterpolatedString;
	values: Array<StringLiteral | Identifier>;
}

export interface BinaryExpression extends NodeBase {
	kind: CmdSyntaxKind.BinaryExpression;
	left: Node;
	operator: OperatorToken;
	right: Node;
	children: Node[];
}

export interface InvalidNode extends NodeBase {
	kind: CmdSyntaxKind.Invalid;
	nodes?: Node[];
	message: string;
}

export interface VariableDeclaration extends NodeBase {
	kind: CmdSyntaxKind.VariableDeclaration;
	modifiers?: never;
	identifier: Identifier;
	expression:
		| NumberLiteral
		| StringLiteral
		| InterpolatedStringExpression
		| BooleanLiteral
		| Identifier
		| InnerExpression;
}

export interface VariableStatement extends NodeBase {
	kind: CmdSyntaxKind.VariableStatement;
	declaration: VariableDeclaration;
}

export interface CommandName extends NodeBase {
	kind: CmdSyntaxKind.CommandName;
	name: StringLiteral;
}

export interface StringLiteral extends NodeBase {
	kind: CmdSyntaxKind.String;
	quotes?: string;
	isUnterminated?: boolean;
	text: string;
}

export interface BooleanLiteral extends NodeBase {
	kind: CmdSyntaxKind.Boolean;
	value: boolean;
}

export interface NumberLiteral extends NodeBase {
	kind: CmdSyntaxKind.Number;
	value: number;
}

export interface CommandStatement extends NodeBase {
	kind: CmdSyntaxKind.CommandStatement;
	command: CommandName;
	isUnterminated?: boolean;
	children: Node[];
}

export interface InnerExpression extends NodeBase {
	kind: CmdSyntaxKind.InnerExpression;
	expression: CommandStatement | BinaryExpression;
}

export interface NodeError {
	node: Node;
	message: string;
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

export function createCommandStatement(command: CommandName, children: Node[]) {
	const statement: CommandStatement = { kind: CmdSyntaxKind.CommandStatement, command, children, flags: 0 };
	for (const child of statement.children) {
		child.parent = statement;
	}

	return statement;
}

export function createInnerExpression(expression: InnerExpression["expression"]) {
	const statement: InnerExpression = { kind: CmdSyntaxKind.InnerExpression, expression, flags: 0 };
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

export function createInvalidNode(message: InvalidNode["message"], nodes: Node[]): InvalidNode {
	return { kind: CmdSyntaxKind.Invalid, message, flags: NodeFlag.NodeHasError, nodes };
}

export function createBinaryExpression(left: Node, op: OperatorToken, right: Node): BinaryExpression {
	const expression: BinaryExpression = {
		kind: CmdSyntaxKind.BinaryExpression,
		left,
		operator: op,
		right,
		children: [left, right],
		flags: 0,
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

export function shiftNodes(node: Node, offset: number) {
	if (node.pos !== undefined && node.endPos !== undefined) {
		node.pos += offset;
		node.endPos += offset;
	}

	if ("children" in node) {
		for (const child of node.children) {
			shiftNodes(child, offset);
		}
	}
}

/////////////////////////////////////////////////
// Checks
/////////////////////////////////////////////////
export interface NodeTypes {
	[CmdSyntaxKind.CommandStatement]: CommandStatement;
	[CmdSyntaxKind.CommandName]: CommandName;
	[CmdSyntaxKind.String]: StringLiteral;
	[CmdSyntaxKind.Option]: Option;
	[CmdSyntaxKind.EndOfStatement]: EndOfStatement;
	[CmdSyntaxKind.Source]: CommandSource;
	[CmdSyntaxKind.Identifier]: Identifier;
	[CmdSyntaxKind.Boolean]: BooleanLiteral;
	[CmdSyntaxKind.Number]: NumberLiteral;
	[CmdSyntaxKind.InterpolatedString]: InterpolatedStringExpression;
	[CmdSyntaxKind.BinaryExpression]: BinaryExpression;
	[CmdSyntaxKind.OperatorToken]: OperatorToken;
	[CmdSyntaxKind.PrefixToken]: PrefixToken;
	[CmdSyntaxKind.PrefixExpression]: PrefixExpression;
	[CmdSyntaxKind.VariableDeclaration]: VariableDeclaration;
	[CmdSyntaxKind.VariableStatement]: VariableStatement;
	[CmdSyntaxKind.Invalid]: InvalidNode;
	[CmdSyntaxKind.InnerExpression]: InnerExpression;
}

type NonParentNode<T> = T extends { children: Node[] } ? never : T;
export type ParentNode = Exclude<Node, NonParentNode<Node>>;

export type NodeKind = keyof NodeTypes;
export type Node = NodeTypes[keyof NodeTypes];

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

const VALID_PREFIX_CHARS = ["~", "@", "%", "^", "*", "!"] as const;
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
