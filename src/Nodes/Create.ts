import { CmdSyntaxKind, NodeFlag } from "./Enum";
import {
	InterpolatedStringExpression,
	StringLiteral,
	CommandName,
	Node,
	CommandStatement,
	InnerExpression,
	PrefixToken,
	PrefixExpression,
	CommandSource,
	NumberLiteral,
	Identifier,
	Option as OptionKey,
	OperatorToken,
	VariableDeclaration,
	VariableStatement,
	BooleanLiteral,
	EndOfStatement,
	InvalidNode,
	BinaryExpression,
	NodeError,
	OptionExpression,
	IfStatement,
} from "./NodeTypes";
import { isNode } from "./Guards";

export function createInterpolatedString(
	...values: InterpolatedStringExpression["values"]
): InterpolatedStringExpression {
	const expression: InterpolatedStringExpression = { kind: CmdSyntaxKind.InterpolatedString, values, flags: 0 };
	for (const value of values) {
		value.parent = expression;
	}
	return expression;
}

export function createNodeError(message: string, node: Node): NodeError {
	return {
		node,
		message,
	};
}

export function createIfStatement(
	condition: IfStatement["condition"],
	thenStatement: IfStatement["thenStatement"],
	elseStatement: IfStatement["elseStatement"],
): IfStatement {
	return { kind: CmdSyntaxKind.IfStatement, flags: 0, condition, thenStatement, elseStatement };
}

/**
 * Flattens an interpolated string into a regular string
 * @param expression The interpolated string expression
 * @param variables The variables for identifiers etc. to flatten with
 */
export function flattenInterpolatedString(
	expression: InterpolatedStringExpression,
	variables: Record<string, defined>,
): StringLiteral {
	let text = "";
	for (const value of expression.values) {
		if (isNode(value, CmdSyntaxKind.Identifier)) {
			text += tostring(variables[value.name]);
		} else {
			text += value.text;
		}
	}
	return { text, kind: CmdSyntaxKind.String, flags: 0 };
}

export function createCommandStatement(command: CommandName, children: Node[], startPos?: number, endPos?: number) {
	const statement: CommandStatement = {
		kind: CmdSyntaxKind.CommandStatement,
		command,
		children,
		flags: 0,
		startPos: startPos,
		endPos,
	};
	for (const child of statement.children) {
		child.parent = statement;
	}

	return statement;
}

export function createInnerExpression(expression: InnerExpression["expression"], startPos?: number, endPos?: number) {
	const statement: InnerExpression = {
		kind: CmdSyntaxKind.InnerExpression,
		expression,
		flags: 0,
		startPos: startPos,
		endPos,
	};
	return statement;
}

export function createPrefixToken(value: PrefixToken["value"]): PrefixToken {
	return { kind: CmdSyntaxKind.PrefixToken, value, flags: 0 };
}

export function createPrefixExpression(
	prefix: PrefixExpression["prefix"],
	expression: PrefixExpression["expression"],
): PrefixExpression {
	return { kind: CmdSyntaxKind.PrefixExpression, prefix, expression, flags: 0 };
}

export function createCommandSource(children: CommandSource["children"]) {
	const statement: CommandSource = { kind: CmdSyntaxKind.Source, children, flags: 0 };
	for (const child of statement.children) {
		child.parent = statement;
	}
	return statement;
}

export function createStringNode(text: string, quotes?: string): StringLiteral {
	return { kind: CmdSyntaxKind.String, text, quotes, flags: 0 };
}

export function createNumberNode(value: number): NumberLiteral {
	return { kind: CmdSyntaxKind.Number, value, flags: 0 };
}

export function createCommandName(name: StringLiteral): CommandName {
	return {
		kind: CmdSyntaxKind.CommandName,
		name,
		flags: 0,
		startPos: name.startPos,
		endPos: name.endPos,
		rawText: name.rawText,
	};
}

export function createIdentifier(name: string): Identifier {
	return { kind: CmdSyntaxKind.Identifier, name, flags: 0 };
}

export function createOptionKey(flag: string, endPos?: number): OptionKey {
	return { kind: CmdSyntaxKind.OptionKey, flag, flags: 0, startPos: endPos ? endPos - flag.size() : 0, endPos };
}

export function createOptionExpression(
	option: OptionKey,
	expression: OptionExpression["expression"],
): OptionExpression {
	return {
		kind: CmdSyntaxKind.OptionExpression,
		startPos: option.startPos,
		endPos: expression.endPos,
		flags: 0,
		option,
		expression,
	};
}

export function createOperator(operator: OperatorToken["operator"], startPos?: number): OperatorToken {
	return {
		kind: CmdSyntaxKind.OperatorToken,
		operator,
		flags: 0,
		startPos,
		endPos: (startPos ?? 0) + operator.size() - 1,
	};
}

export function createVariableDeclaration(
	identifier: Identifier,
	expression: VariableDeclaration["expression"],
): VariableDeclaration {
	return { kind: CmdSyntaxKind.VariableDeclaration, identifier, expression, flags: 0 };
}

export function createVariableStatement(declaration: VariableDeclaration): VariableStatement {
	return { kind: CmdSyntaxKind.VariableStatement, declaration, flags: 0 };
}

export function createBooleanNode(value: boolean): BooleanLiteral {
	return { kind: CmdSyntaxKind.Boolean, value, flags: 0 };
}

export function createEndOfStatementNode(): EndOfStatement {
	return { kind: CmdSyntaxKind.EndOfStatement, flags: 0 };
}

export function createInvalidNode(
	message: InvalidNode["message"],
	expression: Node,
	startPos?: number,
	endPos?: number,
): InvalidNode {
	return {
		kind: CmdSyntaxKind.Invalid,
		expression,
		message,
		flags: NodeFlag.NodeHasError,
		// eslint-disable-next-line roblox-ts/lua-truthiness
		startPos: startPos ?? expression.startPos,
		// eslint-disable-next-line roblox-ts/lua-truthiness
		endPos: endPos ?? expression.endPos,
	};
}

export function createBinaryExpression(
	left: Node,
	op: OperatorToken,
	right: Node,
	startPos?: number,
	endPos?: number,
): BinaryExpression {
	const expression: BinaryExpression = {
		kind: CmdSyntaxKind.BinaryExpression,
		left,
		operator: op,
		right,
		children: [left, right],
		flags: 0,
		startPos: startPos,
		endPos,
	};
	left.parent = expression;
	right.parent = expression;
	return expression;
}
