export enum CmdSyntaxKind {
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

export interface InterpolatedStringExpression extends NodeBase {
	kind: CmdSyntaxKind.InterpolatedString;
	values: Array<StringLiteral | Identifier>;
}

export interface BinaryExpression extends NodeBase {
	kind: CmdSyntaxKind.BinaryExpression;
	left: Node;
	op: OP;
	right: Node;
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
}

export interface Identifier extends NodeBase {
	name: string;
}

export interface End extends NodeBase {
	kind: CmdSyntaxKind.End;
}

export type Node =
	| StringLiteral
	| OperatorLiteral
	| BinaryExpression
	| Identifier
	| Option
	| CommandName
	| InterpolatedStringExpression
	| CommandStatement
	| NumberLiteral
	| End;

////////////////////////////////////////////
// Creators
////////////////////////////////////////////

export function createCommandStatement(command: CommandName, children: Node[]): CommandStatement {
	return { kind: CmdSyntaxKind.CommandStatement, command, children };
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
	return { kind: CmdSyntaxKind.BinaryExpression, left, op, right };
}

export function createInterpolatedString(
	...values: InterpolatedStringExpression["values"]
): InterpolatedStringExpression {
	return { kind: CmdSyntaxKind.InterpolatedString, values };
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
	[CmdSyntaxKind.Identifier]: Identifier;
	[CmdSyntaxKind.Number]: NumberLiteral;
	[CmdSyntaxKind.InterpolatedString]: InterpolatedStringExpression;
	[CmdSyntaxKind.BinaryExpression]: BinaryExpression;
	[CmdSyntaxKind.Operator]: OperatorLiteral;
}

export function isNode<K extends keyof NodeTypes>(node: Node, type: K): node is NodeTypes[K] {
	return node !== undefined && node.kind === type;
}

export function isCommandNode(node: Node): node is CommandName {
	return node.kind === CmdSyntaxKind.CommandName;
}
