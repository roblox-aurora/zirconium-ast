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
