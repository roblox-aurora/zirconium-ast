/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ZrNodeKind, ZrNodeFlag } from "./Enum";
import { ASSIGNABLE } from "./Guards";

export interface NodeTypes {
	[ZrNodeKind.CallExpression]: CallExpression;
	[ZrNodeKind.ExpressionStatement]: ExpressionStatement;
	[ZrNodeKind.SimpleCallExpression]: SimpleCallExpression;
	[ZrNodeKind.IfStatement]: IfStatement;
	[ZrNodeKind.Block]: SourceBlock;
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
	[ZrNodeKind.ArrayLiteralExpression]: ArrayLiteralExpression;
	[ZrNodeKind.ArrayIndexExpression]: ArrayIndexExpression;
	[ZrNodeKind.ParenthesizedExpression]: ParenthesizedExpression;
	[ZrNodeKind.FunctionDeclaration]: FunctionDeclaration;
	[ZrNodeKind.Parameter]: ParameterDeclaration;
	[ZrNodeKind.TypeReference]: TypeReference;
	[ZrNodeKind.ForInStatement]: ForInStatement;
	[ZrNodeKind.ObjectLiteralExpression]: ObjectLiteral;
	[ZrNodeKind.PropertyAssignment]: PropertyAssignment;
	[ZrNodeKind.UnaryExpression]: UnaryExpression;
}

export interface Node {
	kind: ZrNodeKind;
	parent?: Node;
	startPos?: number;
	rawText?: string;
	endPos?: number;
	children?: Node[];
	flags: ZrNodeFlag;
}

export interface Statement extends Node {
	_statementBrand: any;
}

export interface Declaration extends Node {
	_declarationBrand: any;
}

type DeclarationName = Identifier | StringLiteral | NumberLiteral;
export interface NamedDeclaration extends Declaration {
	readonly name?: DeclarationName;
}

type PropertyName = Identifier | StringLiteral | NumberLiteral;
export interface ObjectLiteralElement extends NamedDeclaration {
	_objectLiteralBrand: any;
	readonly name?: PropertyName;
}

export interface LeftHandSideExpression extends Expression {
	_leftHandExpressionBrand: any;
}

export interface Expression extends Node {
	_expressionBrand: symbol;
}
export interface LiteralExpression extends Expression {
	_literalExpressionBrand: any;
}

export interface DeclarationStatement extends Statement {
	readonly name?: Identifier | StringLiteral | NumberLiteral;
}

type OP = "&&" | "|" | "=";

export interface OperatorToken extends Node {
	operator: string;
	kind: ZrNodeKind.OperatorToken;
}

export interface ParenthesizedExpression extends Node {
	kind: ZrNodeKind.ParenthesizedExpression;
	expression: ExpressionStatement;
}

export interface TypeReference extends Node {
	kind: ZrNodeKind.TypeReference;
	typeName: Identifier;
}

export interface ParameterDeclaration extends NamedDeclaration {
	kind: ZrNodeKind.Parameter;
	name: Identifier;
	type?: TypeReference; // TODO: NumberKeyword, StringKeyword etc.
}

export interface ForInStatement extends Statement {
	kind: ZrNodeKind.ForInStatement;
	initializer: Identifier;
	expression: Expression;
	statement: SourceBlock;
}

export interface FunctionDeclaration extends DeclarationStatement {
	kind: ZrNodeKind.FunctionDeclaration;
	name: Identifier;
	parameters: ParameterDeclaration[]; // TODO:
	body: SourceBlock;
}

export interface CommandSource extends Node {
	kind: ZrNodeKind.Source;
	children: Array<Node>;
}

export interface InterpolatedStringExpression extends Expression {
	kind: ZrNodeKind.InterpolatedString;
	values: Array<StringLiteral | Identifier>;
}

export interface UnaryExpression extends Expression {
	kind: ZrNodeKind.UnaryExpression;
	expression: Node;
	operator: string;
}

export interface BinaryExpression extends Expression, Declaration {
	kind: ZrNodeKind.BinaryExpression;
	left: Expression;
	operator: string;
	right: Expression;
	children: Node[];
}

export interface ArrayLiteralExpression extends Expression {
	kind: ZrNodeKind.ArrayLiteralExpression;
	values: Node[];
}

export interface PropertyAssignment extends ObjectLiteralElement {
	kind: ZrNodeKind.PropertyAssignment;
	name: Identifier;
	initializer: Expression;
}

export interface ObjectLiteral extends LiteralExpression {
	kind: ZrNodeKind.ObjectLiteralExpression;
	values: PropertyAssignment[];
}

export interface InvalidNode extends Node {
	kind: ZrNodeKind.Invalid;
	expression: Node;
	message: string;
}

export interface VariableDeclaration extends Declaration {
	kind: ZrNodeKind.VariableDeclaration;
	modifiers?: never;
	identifier: Identifier | PropertyAccessExpression | ArrayIndexExpression;
	expression: AssignableExpression;
}

export interface VariableStatement extends Statement {
	kind: ZrNodeKind.VariableStatement;
	declaration: VariableDeclaration;
}

export interface PropertyAccessExpression extends Expression {
	kind: ZrNodeKind.PropertyAccessExpression;
	expression: Identifier | PropertyAccessExpression | ArrayIndexExpression;
	name: Identifier;
}

export interface ArrayIndexExpression extends Expression {
	kind: ZrNodeKind.ArrayIndexExpression;
	expression: Identifier | PropertyAccessExpression | ArrayIndexExpression;
	index: NumberLiteral;
}

export interface StringLiteral extends LiteralExpression {
	kind: ZrNodeKind.String;
	quotes?: string;
	isUnterminated?: boolean;
	text: string;
}

export interface SourceBlock extends Statement {
	kind: ZrNodeKind.Block;
	statements: Statement[];
}

export type AssignableExpression = NodeTypes[typeof ASSIGNABLE[number]];

export interface IfStatement extends Statement {
	kind: ZrNodeKind.IfStatement;
	condition: Expression | undefined;
	thenStatement: SourceBlock | Statement | undefined;
	elseStatement: IfStatement | SourceBlock | Statement | undefined;
}

export interface ExpressionStatement extends Statement {
	kind: ZrNodeKind.ExpressionStatement;
	expression: Expression;
}

export interface BooleanLiteral extends LiteralExpression {
	kind: ZrNodeKind.Boolean;
	value: boolean;
}

export interface NumberLiteral extends LiteralExpression {
	kind: ZrNodeKind.Number;
	value: number;
}

/**
 * An expression like `func(...)`
 */
export interface CallExpression extends Expression {
	readonly kind: ZrNodeKind.CallExpression;
	readonly expression: Identifier;
	readonly options: OptionExpression[];
	readonly isUnterminated?: boolean;
	readonly arguments: Node[];
}

/**
 * An expression like `func ...`
 */
export interface SimpleCallExpression extends Expression {
	kind: ZrNodeKind.SimpleCallExpression;
	expression: Identifier;
	isUnterminated?: boolean;
	arguments: Node[];
}

export interface InnerExpression extends Expression {
	kind: ZrNodeKind.InnerExpression;
	expression: Statement | BinaryExpression;
}

export interface NodeError {
	node: Node;
	message: string;
}

export interface Option extends LeftHandSideExpression {
	flag: string;
	right?: Node;
}

export interface OptionExpression extends Expression {
	option: Option;
	expression: Expression;
}

export const VALID_PREFIX_CHARS = ["~", "@", "%", "^", "*", "!"] as const;
export interface PrefixToken extends Node {
	value: typeof VALID_PREFIX_CHARS[number];
}

export interface PrefixExpression extends Expression {
	prefix: PrefixToken;
	expression: StringLiteral | NumberLiteral | InterpolatedStringExpression | BooleanLiteral;
}

export interface Identifier extends Declaration, LeftHandSideExpression {
	name: string;
	prefix: string;
}

export interface EndOfStatement extends Node {
	kind: ZrNodeKind.EndOfStatement;
}

type NonParentNode<T> = T extends { children: Node[] } ? never : T;
export type ParentNode = Exclude<Node, NonParentNode<Node>>;

export type NodeKind = keyof NodeTypes;
