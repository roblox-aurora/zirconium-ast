export const enum ZrTokenKind {
	Identifier = "Id",
	Comment = "Comment",
	String = "String",
	InterpolatedString = "InterpolatedString",
	Number = "Number",
	Boolean = "Boolean",
	Operator = "Operator",
	Option = "Option",
	Special = "Special",
	Keyword = "Keyword",
	PropertyAccess = "Property",
	ArrayIndex = "ArrayIndex",
	EndOfStatement = "EndOfStatement",
}

export const KEYWORDS = ["if", "else"];

export interface TokenTypes {
	[ZrTokenKind.Identifier]: IdentifierToken;
	[ZrTokenKind.String]: StringToken;
	[ZrTokenKind.Number]: NumberToken;
	[ZrTokenKind.Operator]: OperatorToken;
	[ZrTokenKind.Special]: SpecialToken;
	[ZrTokenKind.Boolean]: BooleanToken;
	[ZrTokenKind.Keyword]: KeywordToken;
	[ZrTokenKind.InterpolatedString]: InterpolatedStringToken;
	[ZrTokenKind.EndOfStatement]: EndOfStatementToken;
	[ZrTokenKind.ArrayIndex]: ArrayIndexToken;
	[ZrTokenKind.PropertyAccess]: PropertyAccessToken;
	[ZrTokenKind.Option]: OptionToken;
}

export interface TokenBase {
	kind: ZrTokenKind;
	startPos: number;
	endPos: number;
}

export interface OptionToken extends TokenBase {
	kind: ZrTokenKind.Option;
	value: string;
	prefix?: string;
}

export interface IdentifierToken extends TokenBase {
	kind: ZrTokenKind.Identifier;
	value: string;
}

export interface ArrayIndexToken extends TokenBase {
	kind: ZrTokenKind.ArrayIndex;
	value: string;
}

export interface PropertyAccessToken extends TokenBase {
	kind: ZrTokenKind.PropertyAccess;
	properties: string[];
	value: string;
}

export interface BooleanToken extends TokenBase {
	kind: ZrTokenKind.Boolean;
	value: boolean;
	rawText: string;
}

export interface SpecialToken extends TokenBase {
	kind: ZrTokenKind.Special;
	value: string;
}

export interface EndOfStatementToken extends TokenBase {
	kind: ZrTokenKind.EndOfStatement;
	value: string;
}

export interface OperatorToken extends TokenBase {
	kind: ZrTokenKind.Operator;
	value: string;
}

export interface StringToken extends TokenBase {
	kind: ZrTokenKind.String;
	value: string;
	quotes?: string;
}

export function joinInterpolatedString(values: string[], variables: string[]) {
	const resulting = new Array<string>();
	for (const [k, v] of values.entries()) {
		resulting.push(v);

		const matchingVar = variables[k];
		if (matchingVar !== undefined) {
			resulting.push(`$${matchingVar}`);
		}
	}
	return resulting.join("");
}

export interface InterpolatedStringToken extends TokenBase {
	kind: ZrTokenKind.InterpolatedString;
	values: string[];
	value: string;
	variables: string[];
	quotes?: string;
}

type Keywords = typeof KEYWORDS[number];

export interface KeywordToken extends TokenBase {
	kind: ZrTokenKind.Keyword;
	value: Keywords;
}

export interface NumberToken extends TokenBase {
	kind: ZrTokenKind.Number;
	value: number;
	rawText: string;
}

export type Token = TokenTypes[keyof TokenTypes];

export function isToken<K extends keyof TokenTypes>(token: Token, kind: K): token is TokenTypes[K] {
	return token !== undefined && token.kind === kind;
}
