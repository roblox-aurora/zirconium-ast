export const enum ZrTokenKind {
	Identifier = "id",
	Comment = "comment",
	String = "string",
	Number = "number",
	Boolean = "bool",
}

export interface TokenTypes {
	[ZrTokenKind.Identifier]: IdentifierToken;
	[ZrTokenKind.String]: StringToken;
}

export interface TokenBase {
	kind: ZrTokenKind;
}

export interface IdentifierToken extends TokenBase {
	kind: ZrTokenKind.Identifier;
	value: string;
}

export interface StringToken extends TokenBase {
	kind: ZrTokenKind.String;
	value: string;
	quotes?: string;
}

export type Token = TokenTypes[keyof TokenTypes];
