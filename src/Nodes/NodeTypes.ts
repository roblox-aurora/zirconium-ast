import type { CmdSyntaxKind, NodeFlag } from "./Enum";

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

export interface NodeBase {
	kind: CmdSyntaxKind;
	parent?: Node;
	startPos?: number;
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
	expression: Node;
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
	expression: CommandStatement | BinaryExpression | VariableStatement;
}

export interface NodeError {
	node: Node;
	message: string;
}

export interface Option extends NodeBase {
	flag: string;
	right?: Node;
}

export const VALID_PREFIX_CHARS = ["~", "@", "%", "^", "*", "!"] as const;
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

type NonParentNode<T> = T extends { children: Node[] } ? never : T;
export type ParentNode = Exclude<Node, NonParentNode<Node>>;

export type NodeKind = keyof NodeTypes;
export type Node = NodeTypes[keyof NodeTypes];
