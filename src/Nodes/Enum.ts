export enum CmdSyntaxKind {
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
	/** @todo `if (<expression>)` */
	IfStatement,
	/** @todo `[<value>, <value>, ...]` */
	ArrayLiteralExpression,
	/** @todo `$var[0]` */
	ArrayIndexExpression,
	/** @todo `$var.value` */
	IndexExpression,

	/** @todo `for (<var> in <expression>)` */
	ForInStatement,
}

export const enum NodeFlag {
	None = 0,
	NodeHasError = 1 << 16,
}
