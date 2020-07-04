export enum CmdSyntaxKind {
	Unknown,
	Source,
	CommandStatement,
	String,
	StringLiteral,
	CommandName,
	Number,
	Option,
	Identifier,
	Operator,
	BinaryExpression,
	InterpolatedString,
	End,
}

interface NodeBase {
	kind: CmdSyntaxKind;
	parent?: Node;
	pos?: number;
	endPos?: number;
}

type OP = "&&" | "|";

export interface OperatorLiteral extends NodeBase {
	operator: OP;
	kind: CmdSyntaxKind.Operator;
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
	op: OP;
	right: Node;
	children: Node[];
}

export interface CommandName extends NodeBase {
	kind: CmdSyntaxKind.CommandName;
	name: StringLiteral;
}

export interface StringLiteral extends NodeBase {
	kind: CmdSyntaxKind.String;
	text: string;
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

export interface Identifier extends NodeBase {
	name: string;
}

export interface End extends NodeBase {
	kind: CmdSyntaxKind.End;
}

// export type Node =
// 	| StringLiteral
// 	| OperatorLiteral
// 	| BinaryExpression
// 	| Identifier
// 	| Option
// 	| CommandName
// 	| InterpolatedStringExpression
// 	| CommandStatement
// 	| NumberLiteral
// 	| End;

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

export function createCommandSource(children: CommandSource["children"]) {
	const statement: CommandSource = { kind: CmdSyntaxKind.Source, children };
	for (const child of statement.children) {
		child.parent = statement;
	}
	return statement;
}

export function createStringNode(text: string): StringLiteral {
	return { kind: CmdSyntaxKind.String, text };
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

export function createOperator(operator: OperatorLiteral["operator"]): OperatorLiteral {
	return { kind: CmdSyntaxKind.Operator, operator };
}

export function createBinaryExpression(left: Node, op: BinaryExpression["op"], right: Node): BinaryExpression {
	const expression: BinaryExpression = {
		kind: CmdSyntaxKind.BinaryExpression,
		left,
		op,
		right,
		children: [left, right],
	};
	left.parent = expression;
	right.parent = expression;
	return expression;
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
interface NodeTypes {
	[CmdSyntaxKind.CommandStatement]: CommandStatement;
	[CmdSyntaxKind.CommandName]: CommandName;
	[CmdSyntaxKind.String]: StringLiteral;
	[CmdSyntaxKind.Option]: Option;
	[CmdSyntaxKind.Source]: CommandSource;
	[CmdSyntaxKind.Identifier]: Identifier;
	[CmdSyntaxKind.Number]: NumberLiteral;
	[CmdSyntaxKind.InterpolatedString]: InterpolatedStringExpression;
	[CmdSyntaxKind.BinaryExpression]: BinaryExpression;
	[CmdSyntaxKind.Operator]: OperatorLiteral;
}

type NonParentNode<T> = T extends { children: Node[] } ? never : T;
export type ParentNode = Exclude<Node, NonParentNode<Node>>;

export type Node = NodeTypes[keyof NodeTypes];

export function isNode<K extends keyof NodeTypes>(node: Node, type: K): node is NodeTypes[K] {
	return node !== undefined && node.kind === type;
}

export function isParentNode(node: Node): node is ParentNode {
	return "children" in node;
}

export function getKindName(kind: CmdSyntaxKind | undefined) {
	if (kind === undefined) {
		return "<none>";
	}

	return CmdSyntaxKind[kind];
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
