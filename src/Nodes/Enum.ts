export enum ZrNodeKind {
	Unknown,
	/** `cmd ...; cmd2 ...; ...` */
	Source,
	/** `cmd ...` */
	CommandStatement,
	/** `$( ... )` */
	InnerExpression,
	/** `{ ... }` */
	Block,
	/** `"value"` or `'value'` or `value` */
	String,
	/** `true` or `false` */
	Boolean,
	/** `cmd` */
	CommandName,
	/** `10`, `10.0` */
	Number,
	OptionKey,
	/** `--key <value>`, `--key`, `-k` */
	OptionExpression,
	/** `$var` */
	Identifier,
	OperatorToken,
	/** `cmd1 && cmd2`, `cmd1 | cmd2`, `cmd1 || cmd2` */
	BinaryExpression,
	/** `"test $variable interpolated"`, `'test $variable interpolated'` */
	InterpolatedString,
	PrefixToken,
	PrefixExpression,
	EndOfStatement,
	/** `$x = <value>` */
	VariableDeclaration,
	/** `[export] $x = <value>` */
	VariableStatement,
	Invalid,
	/** `if (<expression>)` */
	IfStatement,
	/** `[<value>, <value>, ...]` */
	ArrayLiteralExpression,
	/** `$var[0]` */
	ArrayIndexExpression,
	/** `$var.value` */
	PropertyAccessExpression,

	/** `for (<var> in <expression>)` */
	ForInStatement,

	ParenthesizedExpression,

	/** `function <id>([...parameters]) { <statements> }` */
	FunctionDeclaration,

	/** `<id> [: <typeReference>]` */
	Parameter,

	TypeReference,

	/** `{ a: <expression>, b: <expression>, ... }`  */
	ObjectLiteralExpression,
	/** `id: <expression>` */
	PropertyAssignment,
}

export enum ZrTypeKeyword {
	Any = "any",
}

export const CmdSyntaxKind = ZrNodeKind;

export const enum ZrNodeFlag {
	None = 0,
	Const = 1 << 0,
	Let = 1 << 1,
	NodeHasError = 1 << 16,
}
