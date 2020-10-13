import type { ZrNodeKind, NodeFlag } from "./Enum";
import { ASSIGNABLE } from "./Guards";

export interface NodeTypes {
	[ZrNodeKind.CommandStatement]: CommandStatement;
	[ZrNodeKind.IfStatement]: IfStatement;
	[ZrNodeKind.Block]: Block;
	[ZrNodeKind.CommandName]: CommandName;
	[ZrNodeKind.String]: StringLiteral;
	[ZrNodeKind.OptionKey]: Option;
	[ZrNodeKind.EndOfStatement]: EndOfStatement;
	[ZrNodeKind.Source]: CommandSource;
	[ZrNodeKind.Identifier]: Identifier;
	[ZrNodeKind.PropertyAccessExpression]: PropertyAccessExpression;
	[ZrNodeKind.Boolean]: BooleanLiteral;
	[ZrNodeKind.Number]: NumberLiteral;
	[ZrNodeKind.InterpolatedString]: InterpolatedStringExpression;
	[ZrNodeKind.BinaryExpression]: BinaryExpression;
	[ZrNodeKind.OperatorToken]: OperatorToken;
	[ZrNodeKind.PrefixToken]: PrefixToken;
	[ZrNodeKind.PrefixExpression]: PrefixExpression;
	[ZrNodeKind.VariableDeclaration]: VariableDeclaration;
	[ZrNodeKind.VariableStatement]: VariableStatement;
	[ZrNodeKind.Invalid]: InvalidNode;
	[ZrNodeKind.OptionExpression]: OptionExpression;
	[ZrNodeKind.InnerExpression]: InnerExpression;
	[ZrNodeKind.ArrayLiteralExpression]: ArrayLiteral;
}

export interface NodeBase {
	kind: ZrNodeKind;
	parent?: Node;
	startPos?: number;
	rawText?: string;
	endPos?: number;
	flags: NodeFlag;
}

type OP = "&&" | "|" | "=";

export interface OperatorToken extends NodeBase {
	operator: string;
	kind: ZrNodeKind.OperatorToken;
}

export interface CommandSource extends NodeBase {
	kind: ZrNodeKind.Source;
	children: Array<Node>;
}

export interface InterpolatedStringExpression extends NodeBase {
	kind: ZrNodeKind.InterpolatedString;
	values: Array<StringLiteral | Identifier>;
}

export interface BinaryExpression extends NodeBase {
	kind: ZrNodeKind.BinaryExpression;
	left: Node;
	operator: OperatorToken;
	right: Node;
	children: Node[];
}

export interface ArrayLiteral extends NodeBase {
	kind: ZrNodeKind.ArrayLiteralExpression;
	values: Node[];
}

export interface InvalidNode extends NodeBase {
	kind: ZrNodeKind.Invalid;
	expression: Node;
	message: string;
}

export interface VariableDeclaration extends NodeBase {
	kind: ZrNodeKind.VariableDeclaration;
	modifiers?: never;
	identifier: Identifier;
	expression: AssignableExpression;
}

export interface VariableStatement extends NodeBase {
	kind: ZrNodeKind.VariableStatement;
	declaration: VariableDeclaration;
}

export interface PropertyAccessExpression extends NodeBase {
	kind: ZrNodeKind.PropertyAccessExpression;
	expression: Identifier;
	name: Identifier;
}

export interface CommandName extends NodeBase {
	kind: ZrNodeKind.CommandName;
	name: StringLiteral;
}

export interface StringLiteral extends NodeBase {
	kind: ZrNodeKind.String;
	quotes?: string;
	isUnterminated?: boolean;
	text: string;
}

export interface Block extends NodeBase {
	kind: ZrNodeKind.Block;
	statements: (CommandStatement | VariableStatement)[];
}

export type ExpressionStatement =
	| NumberLiteral
	| BooleanLiteral
	| StringLiteral
	| InterpolatedStringExpression
	| Identifier
	| BinaryExpression
	| IfStatement
	| CommandStatement
	| VariableStatement
	| ArrayLiteral
	| PropertyAccessExpression;
export type Statement = CommandStatement | VariableStatement;
export type AssignableExpression = NodeTypes[typeof ASSIGNABLE[number]];
export interface IfStatement extends NodeBase {
	kind: ZrNodeKind.IfStatement;
	condition: ExpressionStatement | undefined;
	thenStatement: Block | Statement | undefined;
	elseStatement: Block | Statement | undefined;
}

export interface BooleanLiteral extends NodeBase {
	kind: ZrNodeKind.Boolean;
	value: boolean;
}

export interface NumberLiteral extends NodeBase {
	kind: ZrNodeKind.Number;
	value: number;
}

export interface CommandStatement extends NodeBase {
	kind: ZrNodeKind.CommandStatement;
	command: CommandName;
	isUnterminated?: boolean;
	children: Node[];
}

export interface InnerExpression extends NodeBase {
	kind: ZrNodeKind.InnerExpression;
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

export interface OptionExpression extends NodeBase {
	option: Option;
	expression: Identifier | StringLiteral | InterpolatedStringExpression | BooleanLiteral | NumberLiteral;
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
	kind: ZrNodeKind.EndOfStatement;
}

type NonParentNode<T> = T extends { children: Node[] } ? never : T;
export type ParentNode = Exclude<Node, NonParentNode<Node>>;

export type NodeKind = keyof NodeTypes;
export type Node = NodeTypes[keyof NodeTypes];
