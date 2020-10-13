import { ZrNodeKind, NodeFlag, ZrTypeKeyword } from "./Enum";
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
	ArrayLiteral,
	PropertyAccessExpression,
	ArrayIndexExpression,
	SourceBlock,
	Statement,
	ParenthesizedExpression,
	FunctionDeclaration,
	Parameter,
	TypeReference,
} from "./NodeTypes";
import { isNode } from "./Guards";

export function createInterpolatedString(
	...values: InterpolatedStringExpression["values"]
): InterpolatedStringExpression {
	const expression: InterpolatedStringExpression = { kind: ZrNodeKind.InterpolatedString, values, flags: 0 };
	for (const value of values) {
		value.parent = expression;
	}
	return expression;
}

export function createArrayLiteral(values: ArrayLiteral["values"]) {
	return identity<ArrayLiteral>({
		kind: ZrNodeKind.ArrayLiteralExpression,
		flags: 0,
		values,
	});
}

export function createArrayIndexExpression(
	expression: ArrayIndexExpression["expression"],
	index: ArrayIndexExpression["index"],
) {
	return identity<ArrayIndexExpression>({
		kind: ZrNodeKind.ArrayIndexExpression,
		flags: 0,
		expression,
		index,
	});
}

export function createPropertyAccessExpression(
	expression: PropertyAccessExpression["expression"],
	name: PropertyAccessExpression["name"],
) {
	return identity<PropertyAccessExpression>({
		kind: ZrNodeKind.PropertyAccessExpression,
		flags: 0,
		expression,
		name,
	});
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
	return { kind: ZrNodeKind.IfStatement, flags: 0, condition, thenStatement, elseStatement };
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
		if (isNode(value, ZrNodeKind.Identifier)) {
			text += tostring(variables[value.name]);
		} else {
			text += value.text;
		}
	}
	return { text, kind: ZrNodeKind.String, flags: 0 };
}

export function createBlock(statements: Statement[]) {
	return identity<SourceBlock>({
		kind: ZrNodeKind.Block,
		statements,
		flags: 0,
	});
}

export function createTypeReference(typeName: TypeReference["typeName"]) {
	return identity<TypeReference>({
		kind: ZrNodeKind.TypeReference,
		typeName,
		flags: 0,
	});
}

export function createKeywordTypeNode(keyword: ZrTypeKeyword) {
	return createTypeReference(createIdentifier(keyword));
}

export function createParameter(name: Parameter["name"], type: Parameter["type"]) {
	return identity<Parameter>({
		kind: ZrNodeKind.Parameter,
		name,
		type,
		flags: 0,
	});
}

export function createFunctionDeclaration(
	name: FunctionDeclaration["name"],
	parameters: FunctionDeclaration["parameters"],
	body: FunctionDeclaration["body"],
) {
	return identity<FunctionDeclaration>({
		kind: ZrNodeKind.FunctionDeclaration,
		name,
		body,
		parameters,
		flags: 0,
	});
}

export function createParenthesizedExpression(expression: ParenthesizedExpression["expression"]) {
	return identity<ParenthesizedExpression>({
		kind: ZrNodeKind.ParenthesizedExpression,
		expression,
		flags: 0,
	});
}

export function createCommandStatement(command: CommandName, children: Node[], startPos?: number, endPos?: number) {
	const statement: CommandStatement = {
		kind: ZrNodeKind.CommandStatement,
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
		kind: ZrNodeKind.InnerExpression,
		expression,
		flags: 0,
		startPos: startPos,
		endPos,
	};
	return statement;
}

export function createPrefixToken(value: PrefixToken["value"]): PrefixToken {
	return { kind: ZrNodeKind.PrefixToken, value, flags: 0 };
}

export function createPrefixExpression(
	prefix: PrefixExpression["prefix"],
	expression: PrefixExpression["expression"],
): PrefixExpression {
	return { kind: ZrNodeKind.PrefixExpression, prefix, expression, flags: 0 };
}

export function createCommandSource(children: CommandSource["children"]) {
	const statement: CommandSource = { kind: ZrNodeKind.Source, children, flags: 0 };
	for (const child of statement.children) {
		child.parent = statement;
	}
	return statement;
}

export function createStringNode(text: string, quotes?: string): StringLiteral {
	return { kind: ZrNodeKind.String, text, quotes, flags: 0 };
}

export function createNumberNode(value: number): NumberLiteral {
	return { kind: ZrNodeKind.Number, value, flags: 0 };
}

export function createCommandName(name: StringLiteral): CommandName {
	return {
		kind: ZrNodeKind.CommandName,
		name,
		flags: 0,
		startPos: name.startPos,
		endPos: name.endPos,
		rawText: name.rawText,
	};
}

export function createIdentifier(name: string): Identifier {
	return { kind: ZrNodeKind.Identifier, name, flags: 0 };
}

export function createOptionKey(flag: string, endPos?: number): OptionKey {
	return { kind: ZrNodeKind.OptionKey, flag, flags: 0, startPos: endPos ? endPos - flag.size() : 0, endPos };
}

export function createOptionExpression(
	option: OptionKey,
	expression: OptionExpression["expression"],
): OptionExpression {
	return {
		kind: ZrNodeKind.OptionExpression,
		startPos: option.startPos,
		endPos: expression.endPos,
		flags: 0,
		option,
		expression,
	};
}

export function createOperator(operator: OperatorToken["operator"], startPos?: number): OperatorToken {
	return {
		kind: ZrNodeKind.OperatorToken,
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
	return { kind: ZrNodeKind.VariableDeclaration, identifier, expression, flags: 0 };
}

export function createVariableStatement(declaration: VariableDeclaration): VariableStatement {
	return { kind: ZrNodeKind.VariableStatement, declaration, flags: 0 };
}

export function createBooleanNode(value: boolean): BooleanLiteral {
	return { kind: ZrNodeKind.Boolean, value, flags: 0 };
}

export function createEndOfStatementNode(): EndOfStatement {
	return { kind: ZrNodeKind.EndOfStatement, flags: 0 };
}

export function createInvalidNode(
	message: InvalidNode["message"],
	expression: Node,
	startPos?: number,
	endPos?: number,
): InvalidNode {
	return {
		kind: ZrNodeKind.Invalid,
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
		kind: ZrNodeKind.BinaryExpression,
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
