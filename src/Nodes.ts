export enum ParserSyntaxKind {
	CommandStatement,
	String,
	StringLiteral,
	CommandName,
	Number,
	Option,
	Identifier,
	Operator,
	BinaryExpression,
	End,
}

interface NodeBase {
	kind: ParserSyntaxKind;
	parent?: Node;
	pos?: number;
	endPos?: number;
}

type OP = "&&" | "|";

export interface OperatorNode extends NodeBase {
	operator: OP;
	kind: ParserSyntaxKind.Operator;
}

export interface BinaryExpression extends NodeBase {
	kind: ParserSyntaxKind.BinaryExpression;
	left: Node;
	op: OP;
	right: Node;
}

export interface CommandNameNode extends NodeBase {
	kind: ParserSyntaxKind.CommandName;
	name: StringNode;
}

export interface StringNode extends NodeBase {
	kind: ParserSyntaxKind.String;
	text: string;
}

export interface NumberNode extends NodeBase {
	kind: ParserSyntaxKind.Number;
	value: number;
}

export interface CommandStatement extends NodeBase {
	kind: ParserSyntaxKind.CommandStatement;
	command: CommandNameNode;
	children: Node[];
}

export interface FlagNode extends NodeBase {
	flag: string;
}

export interface IdentifierNode extends NodeBase {
	name: string;
}

export interface End extends NodeBase {
	kind: ParserSyntaxKind.End;
}

export type Node =
	| StringNode
	| OperatorNode
	| BinaryExpression
	| IdentifierNode
	| FlagNode
	| CommandNameNode
	| CommandStatement
	| NumberNode
	| End;

////////////////////////////////////////////
// Creators
////////////////////////////////////////////

export function createCommandStatement(command: CommandNameNode, children: Node[]): CommandStatement {
	return { kind: ParserSyntaxKind.CommandStatement, command, children };
}

export function createStringNode(text: string): StringNode {
	return { kind: ParserSyntaxKind.String, text };
}

export function createNumberNode(value: number): NumberNode {
	return { kind: ParserSyntaxKind.Number, value };
}

export function createCommandName(name: string): CommandNameNode {
	return { kind: ParserSyntaxKind.CommandName, name: { kind: ParserSyntaxKind.String, text: name } };
}

export function createIdentifier(name: string): IdentifierNode {
	return { kind: ParserSyntaxKind.Identifier, name };
}

export function createOption(flag: string): FlagNode {
	return { kind: ParserSyntaxKind.Option, flag };
}

export function createOperator(operator: OperatorNode["operator"]): OperatorNode {
	return { kind: ParserSyntaxKind.Operator, operator };
}

export function createBinaryExpression(left: Node, op: BinaryExpression["op"], right: Node): BinaryExpression {
	return { kind: ParserSyntaxKind.BinaryExpression, left, op, right };
}

export function getSiblingNode(nodes: Node[], kind: ParserSyntaxKind.CommandName): CommandNameNode | undefined;
export function getSiblingNode(nodes: Node[], kind: ParserSyntaxKind) {
	return nodes.find((f) => f.kind === kind);
}

/////////////////////////////////////////////////
// Checks
/////////////////////////////////////////////////
interface NodeTypes {
	[ParserSyntaxKind.CommandStatement]: CommandStatement;
	[ParserSyntaxKind.CommandName]: CommandNameNode;
	[ParserSyntaxKind.String]: StringNode;
	[ParserSyntaxKind.Option]: FlagNode;
	[ParserSyntaxKind.Identifier]: IdentifierNode;
	[ParserSyntaxKind.Number]: NumberNode;
	[ParserSyntaxKind.BinaryExpression]: BinaryExpression;
	[ParserSyntaxKind.Operator]: OperatorNode;
}

export function isNode<K extends keyof NodeTypes>(node: Node, type: K): node is NodeTypes[K] {
	return node !== undefined && node.kind === type;
}

export function isCommandNode(node: Node): node is CommandNameNode {
	return node.kind === ParserSyntaxKind.CommandName;
}
