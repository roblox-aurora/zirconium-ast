export enum CmdSyntaxKind {
	Unknown,
	Source,
	CommandStatement,
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
}

interface NodeBase {
	kind: CmdSyntaxKind;
	parent?: Node;
	pos?: number;
	endPos?: number;
}

type OP = "&&" | "|";

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

export interface CommandName extends NodeBase {
	kind: CmdSyntaxKind.CommandName;
	name: StringLiteral;
}

export interface StringLiteral extends NodeBase {
	kind: CmdSyntaxKind.String;
	quotes?: string;
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
	children: Node[];
}

export interface Option extends NodeBase {
	flag: string;
	right?: Node;
}

export interface PrefixToken extends NodeBase {
	value: string;
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
	const statement: CommandStatement = { kind: CmdSyntaxKind.CommandStatement, command, children };
	for (const child of statement.children) {
		child.parent = statement;
	}

	return statement;
}

export function createPrefixToken(value: PrefixToken["value"]): PrefixToken {
	return { kind: CmdSyntaxKind.PrefixToken, value };
}

export function createPrefixExpression(prefix: PrefixExpression["prefix"], expression: PrefixExpression["expression"]) {
	return { kind: CmdSyntaxKind.PrefixExpression, prefix, expression };
}

export function createCommandSource(children: CommandSource["children"]) {
	const statement: CommandSource = { kind: CmdSyntaxKind.Source, children };
	for (const child of statement.children) {
		child.parent = statement;
	}
	return statement;
}

export function createStringNode(text: string, quotes?: string): StringLiteral {
	return { kind: CmdSyntaxKind.String, text, quotes };
}

export function createNumberNode(value: number): NumberLiteral {
	return { kind: CmdSyntaxKind.Number, value };
}

export function createCommandName(name: string): CommandName {
	return { kind: CmdSyntaxKind.CommandName, name: { kind: CmdSyntaxKind.String, text: name } };
}

export function createIdentifier(name: string): Identifier {
	return { kind: CmdSyntaxKind.Identifier, name };
}

export function createOption(flag: string): Option {
	return { kind: CmdSyntaxKind.Option, flag };
}

export function createOperator(operator: OperatorToken["operator"]): OperatorToken {
	return { kind: CmdSyntaxKind.OperatorToken, operator };
}

export function createBooleanNode(value: boolean): BooleanLiteral {
	return { kind: CmdSyntaxKind.Boolean, value };
}

export function createEndOfStatementNode(): EndOfStatement {
	return { kind: CmdSyntaxKind.EndOfStatement };
}

export function createBinaryExpression(left: Node, op: OperatorToken, right: Node): BinaryExpression {
	const expression: BinaryExpression = {
		kind: CmdSyntaxKind.BinaryExpression,
		left,
		operator: op,
		right,
		children: [left, right],
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
	return { text, kind: CmdSyntaxKind.String };
}

export function createInterpolatedString(
	...values: InterpolatedStringExpression["values"]
): InterpolatedStringExpression {
	const expression: InterpolatedStringExpression = { kind: CmdSyntaxKind.InterpolatedString, values };
	for (const value of values) {
		value.parent = expression;
	}
	return expression;
}

export function getSiblingNode(nodes: Node[], kind: CmdSyntaxKind.CommandName): CommandName | undefined;
export function getSiblingNode(nodes: Node[], kind: CmdSyntaxKind) {
	return nodes.find((f) => f.kind === kind);
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
}

type NonParentNode<T> = T extends { children: Node[] } ? never : T;
export type ParentNode = Exclude<Node, NonParentNode<Node>>;

export type NodeKind = keyof NodeTypes;
export type Node = NodeTypes[keyof NodeTypes];

export function isNode<K extends keyof NodeTypes>(node: Node, type: K): node is NodeTypes[K] {
	return node !== undefined && node.kind === type;
}

export function isNodeIn<K extends keyof NodeTypes>(node: Node, type: K[]): node is NodeTypes[K] {
	return node !== undefined && (type as Array<CmdSyntaxKind>).includes(node.kind);
}

export function isParentNode(node: Node): node is ParentNode {
	return "children" in node;
}

const VALID_PREFIX_CHARS = ["~", "@", "%", "^", "&", "*", "!"] as const;
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
