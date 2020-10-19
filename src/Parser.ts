import { AstCommandDefinitions } from "Definitions/Definitions";
import ZrLexer from "Lexer";
import { ZrNodeKind, isNode } from "Nodes";
import {
	createArrayIndexExpression,
	createArrayLiteral,
	createBinaryExpression,
	createBlock,
	createBooleanNode,
	createCommandName,
	createCommandSource,
	createCommandStatement,
	createForInStatement,
	createFunctionDeclaration,
	createIdentifier,
	createIfStatement,
	createInterpolatedString,
	createKeywordTypeNode,
	createNumberNode,
	createObjectLiteral,
	createOperator,
	createOptionExpression,
	createOptionKey,
	createParameter,
	createPropertyAccessExpression,
	createPropertyAssignment,
	createStringNode,
	createTypeReference,
	createUnaryExpression,
	createVariableDeclaration,
	createVariableStatement,
} from "Nodes/Create";
import { ZrNodeFlag, ZrTypeKeyword } from "Nodes/Enum";
import { getFriendlyName } from "Nodes/Functions";
import { isAssignableExpression } from "Nodes/Guards";
import {
	ArrayIndexExpression,
	AssignableExpression,
	ExpressionStatement,
	Identifier,
	Node,
	Parameter,
	PropertyAccessExpression,
	PropertyAssignment,
	SourceBlock,
	Statement,
	StringLiteral,
} from "Nodes/NodeTypes";
import Grammar, { UnaryOperatorsTokens } from "Tokens/Grammar";
import {
	IdentifierToken,
	InterpolatedStringToken,
	isToken,
	OperatorToken,
	StringToken,
	Token,
	TokenTypes,
	ZrTokenKind,
} from "Tokens/Tokens";

interface ZrParserOptions {
	commands: AstCommandDefinitions;
}

export const enum ZrParserErrorCode {
	Unexpected = 1001,
	UnexpectedWord,
	InvalidVariableAssignment,
	IdentifierExpected,
	ExpectedToken,
	NotImplemented,
	ExpressionExpected,
}

export const enum ZrParserWarningCode {
	/**
	 * Function names do not require $ prefix.
	 */
	FunctionIdWithPrefix = 1,
}

export interface ParserError {
	message: string;
	code: ZrParserErrorCode;
	node?: Node;
	token?: Token;
}

export interface ParserWarning {
	message: string;
	code: ZrParserWarningCode;
	node?: Node;
	token?: Token;
}

export default class ZrParser {
	private preventCommandParsing = false;
	private ignoreWhitespace = false;
	private strict = false;
	private errors = new Array<ParserError>();
	private warnings = new Array<ParserWarning>();
	private functionCallScope = 0;

	public constructor(private lexer: ZrLexer) {}

	private parserError(message: string, code: ZrParserErrorCode, token?: Token): never {
		this.errors.push(
			identity<ParserError>({
				message,
				code,
				token,
			}),
		);
		this.throwParserError(token ? `[${token.startPos}:${token.endPos}] ${message}` : message);
	}

	private parserWarning(message: string, code: ZrParserWarningCode) {
		this.warnings.push(
			identity<ParserWarning>({ message, code }),
		);
	}

	private parserNodeError(message: string, code: ZrParserErrorCode, node?: Node): never {
		this.errors.push(
			identity<ParserError>({
				message,
				code,
				node,
			}),
		);
		this.throwParserError(message);
	}

	private throwParserError(message: string): never {
		throw `[ZParser] Parsing Error: ${message}`;
	}

	/**
	 * Checks whether or not the specified token kind is the current
	 */
	private is(kind: ZrTokenKind, value?: string | number | boolean) {
		const token = this.lexer.peek();
		if (value !== undefined) {
			return token !== undefined && token.kind === kind && token.value === value;
		} else {
			return token !== undefined && token.kind === kind;
		}
	}

	/**
	 * Gets the token of the specified kind, if it's the next token
	 */
	public get<K extends keyof TokenTypes>(kind: K, value?: TokenTypes[K]["value"]): TokenTypes[K] | undefined {
		return this.is(kind, value) ? (this.lexer.peek()! as TokenTypes[K]) : undefined;
	}

	/**
	 * Skips a token of a specified kind if it's the next
	 */
	private skip(kind: ZrTokenKind, value: string | number | boolean, message?: string) {
		if (this.is(kind, value)) {
			return this.lexer.next();
		} else {
			const node = this.lexer.peek();
			this.parserError(message ?? "Expected '" + value + "'", ZrParserErrorCode.Unexpected, node);
		}
	}

	/**
	 * Skips token if it exists.
	 */
	private skipIf(kind: ZrTokenKind, value: string | number | boolean) {
		if (this.is(kind, value)) {
			this.lexer.next();
			return true;
		} else {
			return false;
		}
	}

	private parseBlock() {
		if (this.is(ZrTokenKind.Special, "{")) {
			const block = this.parseSource("{", "}") as Statement[];
			return createBlock(block);
		} else {
			this.parserError("Expected '{'", ZrParserErrorCode.ExpectedToken);
		}
	}

	/**
	 * Parses an inline statement (e.g. `if $true: <expression>`)
	 *
	 * Short-hand and only takes one expression. For multiple use `parseBlock`.
	 */
	private parseInlineStatement() {
		if (this.is(ZrTokenKind.Special, ":")) {
			this.skip(ZrTokenKind.Special, ":");
			return createBlock([this.mutateExpressionStatement(this.parseNextExpression()) as Statement]);
		} else {
			this.parserError("Expected ':' got  " + this.lexer.peek()?.kind, ZrParserErrorCode.ExpectedToken);
		}
	}

	private parseBlockOrInlineStatement() {
		if (this.is(ZrTokenKind.Special, ":")) {
			return this.parseInlineStatement();
		} else {
			return this.parseBlock();
		}
	}

	private parseParameters() {
		const parameters = new Array<Parameter>();
		if (this.is(ZrTokenKind.Special, "(")) {
			this.skip(ZrTokenKind.Special, "(");

			let index = 0;
			while (this.lexer.hasNext() && !this.is(ZrTokenKind.Special, ")")) {
				if (index > 0) {
					this.skip(ZrTokenKind.Special, ",");
				}

				index++;

				// If valid parameter
				if (this.is(ZrTokenKind.Identifier)) {
					const id = this.lexer.next() as IdentifierToken;

					// Check for parameter type
					if (this.is(ZrTokenKind.Special, ":")) {
						this.skip(ZrTokenKind.Special, ":");

						// TODO: More advanced types later.
						if (this.is(ZrTokenKind.String)) {
							const typeName = this.lexer.next() as StringToken;
							parameters.push(
								createParameter(
									createIdentifier(id.value),
									createTypeReference(createIdentifier(typeName.value)),
								),
							);
						} else {
							this.parserError("Type expected", ZrParserErrorCode.Unexpected);
						}
					} else {
						parameters.push(
							createParameter(createIdentifier(id.value), createKeywordTypeNode(ZrTypeKeyword.Any)),
						);
					}
				} else {
					this.parserError(`Expected identifier`, ZrParserErrorCode.IdentifierExpected);
				}
			}
			this.skip(ZrTokenKind.Special, ")");
		} else {
			this.parserError("'(' expected got '" + this.lexer.peek()?.value + "'", ZrParserErrorCode.ExpectedToken);
		}
		return parameters;
	}

	private parseFor() {
		this.skip(ZrTokenKind.Keyword, "for");
		if (this.lexer.isNextOfKind(ZrTokenKind.Identifier)) {
			const id = this.lexer.next() as IdentifierToken;

			if (this.is(ZrTokenKind.Keyword, "in")) {
				this.lexer.next();
				const targetId = this.get(ZrTokenKind.Identifier);
				if (targetId !== undefined) {
					this.lexer.next();

					return createForInStatement(
						createIdentifier(id.value),
						createIdentifier(targetId.value),
						this.parseBlockOrInlineStatement(),
					);
				} else if (!this.lexer.isNextOfKind(ZrTokenKind.EndOfStatement)) {
					const expression = this.mutateExpressionStatement(this.parseNextExpression());
					if (isNode(expression, ZrNodeKind.CommandStatement)) {
						return createForInStatement(
							createIdentifier(id.value),
							expression,
							this.parseBlockOrInlineStatement(),
						);
					} else {
						this.parserError(
							"ForIn statement expects identifier or command statement",
							ZrParserErrorCode.IdentifierExpected,
						);
					}
				} else {
					this.parserError(
						"ForIn statement expects expression after 'in'",
						ZrParserErrorCode.ExpressionExpected,
					);
				}
			} else {
				this.parserError("'in' expected after identifier", ZrParserErrorCode.ExpectedToken);
			}
		} else {
			this.parserError("Identifier expected after 'for'", ZrParserErrorCode.IdentifierExpected);
		}
	}

	private parseFunction() {
		this.skip(ZrTokenKind.Keyword, "function");

		if (this.lexer.isNextOfAnyKind(ZrTokenKind.String, ZrTokenKind.Identifier)) {
			const id = this.lexer.next() as StringToken | IdentifierToken;
			const idNode = createIdentifier(id.value);

			const paramList = this.parseParameters();

			if (this.is(ZrTokenKind.Special, "{")) {
				const body = this.parseBlock();

				return createFunctionDeclaration(idNode, paramList, body);
			} else {
				this.parserError("Function implementation is missing", ZrParserErrorCode.NotImplemented);
			}
		} else {
			this.parserError("Identifier expected", ZrParserErrorCode.IdentifierExpected);
		}
	}

	private parseIfStatement() {
		this.skip(ZrTokenKind.Keyword, "if");

		let expr: ExpressionStatement;
		if (this.is(ZrTokenKind.Special, "(")) {
			expr = this.parseSource("(", ")")[0] as ExpressionStatement;
		} else {
			expr = this.mutateExpressionStatement(this.parseNextExpression());
		}

		const node = createIfStatement(expr, undefined, undefined);

		if (this.is(ZrTokenKind.Special, ":")) {
			node.thenStatement = this.parseInlineStatement();
			return node;
		} else if (this.is(ZrTokenKind.Special, "{")) {
			node.thenStatement = this.parseBlock();
		}

		if (this.is(ZrTokenKind.Keyword, "else")) {
			this.lexer.next();

			if (this.is(ZrTokenKind.Keyword, "if")) {
				node.elseStatement = this.parseIfStatement();
			} else if (this.is(ZrTokenKind.Special, "{")) {
				node.elseStatement = this.parseBlock();
			}
		}

		return node;
	}

	private isOperatorToken() {
		return this.lexer.isNextOfKind(ZrTokenKind.Operator);
	}

	private isEndBracketOrBlockToken() {
		return (
			this.is(ZrTokenKind.Special, ")") || this.is(ZrTokenKind.Special, "{") || this.is(ZrTokenKind.Special, ":")
		);
	}

	private parseCommandStatement(token: StringToken, isStrictFunctionCall = this.strict) {
		const commandName = createCommandName(createStringNode(token.value));

		const nodes = new Array<Node>();
		nodes.push(commandName);

		// Enable 'strict' function-like calls e.g. `kill(vorlias)` vs `kill vorlias`
		if (this.is(ZrTokenKind.Special, "(") || isStrictFunctionCall) {
			this.skip(ZrTokenKind.Special, "(");
			isStrictFunctionCall = true;
			this.strict = true;
		}

		this.functionCallScope += 1;

		let argumentIndex = 0;
		while (
			this.lexer.hasNext() &&
			(!this.isNextEndOfStatement() || isStrictFunctionCall) &&
			!this.isOperatorToken() &&
			!this.isEndBracketOrBlockToken()
		) {
			if (isStrictFunctionCall && this.is(ZrTokenKind.Special, ")")) {
				break;
			}

			const isEscaped = this.is(ZrTokenKind.Special, "\\") && this.skip(ZrTokenKind.Special, "\\");
			if ((isStrictFunctionCall || isEscaped) && this.skipIf(ZrTokenKind.EndOfStatement, "\n")) {
				continue;
			}

			if (isStrictFunctionCall && argumentIndex > 0) {
				this.skip(ZrTokenKind.Special, ",");
			}

			isStrictFunctionCall && this.skipIf(ZrTokenKind.EndOfStatement, "\n");

			this.preventCommandParsing = !this.strict;
			nodes.push(this.parseNextExpressionStatement());
			this.preventCommandParsing = false;
			argumentIndex++;
		}

		if (isStrictFunctionCall) {
			this.skip(ZrTokenKind.Special, ")");
			this.strict = false;
		}

		this.functionCallScope -= 1;

		return createCommandStatement(commandName, nodes);
	}

	/**
	 * Handles the parsing of a `InterpolatedStringToken`
	 * @param token The `InterpolatedStringToken`
	 * @returns the InterpolatedStringExpression
	 */
	private parseInterpolatedString(token: InterpolatedStringToken) {
		const { values, variables } = token;
		const resulting = new Array<StringLiteral | Identifier>();
		for (const [k, v] of values.entries()) {
			resulting.push(createStringNode(v));

			const matchingVar = variables[k];
			if (matchingVar !== undefined) {
				resulting.push(createIdentifier(matchingVar));
			}
		}
		return createInterpolatedString(...resulting);
	}

	private parseListExpression<K extends Node = Node>(
		start: string,
		stop: string,
		next: () => K,
		separator = ",",
		strict = this.strict,
	): K[] {
		const values = new Array<K>();
		let index = 0;

		this.skip(ZrTokenKind.Special, start);
		this.preventCommandParsing = true;
		this.ignoreWhitespace = true;

		while (this.lexer.hasNext()) {
			if (this.is(ZrTokenKind.Special, stop)) {
				break;
			}

			if (this.skipIf(ZrTokenKind.EndOfStatement, "\n")) {
				continue;
			}

			if (index > 0 && (this.is(ZrTokenKind.Special, separator) || strict)) {
				this.skip(ZrTokenKind.Special, separator);
			}

			this.skipIf(ZrTokenKind.EndOfStatement, "\n");

			values.push(next());

			index++;
		}

		this.ignoreWhitespace = false;
		this.preventCommandParsing = false;

		this.skipIf(ZrTokenKind.EndOfStatement, "\n");
		this.skip(ZrTokenKind.Special, stop);

		return values;
	}

	private parseObjectPropertyAssignment(): PropertyAssignment {
		if (this.lexer.isNextOfAnyKind(ZrTokenKind.Identifier, ZrTokenKind.String)) {
			const id = this.lexer.next() as StringToken;
			this.skip(ZrTokenKind.Special, ":"); // Expects ':'

			const preventCommandParsing = this.preventCommandParsing;
			this.preventCommandParsing = false;
			const expression = this.parseNextExpressionStatement();
			this.preventCommandParsing = preventCommandParsing;
			return createPropertyAssignment(createIdentifier(id.value), expression);
		} else {
			this.parserError("Expected Identifier", ZrParserErrorCode.IdentifierExpected, this.lexer.peek());
		}
	}

	private parseObjectExpression() {
		const values = this.parseListExpression("{", "}", () => this.parseObjectPropertyAssignment(), ",", true);
		return createObjectLiteral(values);
	}

	private parseArrayExpression() {
		const values = this.parseListExpression("[", "]", () => this.parseNextExpressionStatement());
		return createArrayLiteral(values);
	}

	private parseUnaryExpression() {
		const token = this.lexer.next() as OperatorToken;
		const rhs = this.mutateExpressionStatement(this.parseNextExpressionStatement());
		return createUnaryExpression(token.value, rhs);
	}

	private parseStrictFunctionOption(option: string) {
		this.skip(ZrTokenKind.Special, ":");
		return createOptionExpression(
			createOptionKey(option),
			this.mutateExpressionStatement(this.parseNextExpressionStatement()) as AssignableExpression,
		);
	}

	/**
	 * Parses the next expression statement
	 */
	private parseNextExpressionStatement(): ExpressionStatement {
		if (this.is(ZrTokenKind.Special, "(")) {
			this.lexer.next();
			const expr = this.parseNextExpression();
			this.skip(ZrTokenKind.Special, ")");
			return expr;
		}

		if (this.is(ZrTokenKind.Keyword, "function")) {
			return this.parseFunction();
		}

		if (this.is(ZrTokenKind.Keyword, "for")) {
			return this.parseFor();
		}

		if (this.is(ZrTokenKind.Special, "{")) {
			if (this.isAssignmentExpression) {
				return this.parseObjectExpression();
			} else {
				return this.parseBlock();
			}
		}

		if (this.is(ZrTokenKind.Keyword, "if")) {
			return this.parseIfStatement();
		}

		if (this.is(ZrTokenKind.Special, "[")) {
			return this.parseArrayExpression();
		}

		// Handle literals
		const token = this.lexer.next();
		assert(token);

		if (isToken(token, ZrTokenKind.String)) {
			if (this.preventCommandParsing || token.quotes !== undefined) {
				if (this.strict && token.quotes === undefined) {
					this.parserError("Unexpected '" + token.value + "'", ZrParserErrorCode.UnexpectedWord);
				}

				return createStringNode(token.value, token.quotes);
			} else if (token.value !== "") {
				assert(token.value.match("[%w_.]+")[0], `Invalid command expression: '${token.value}'`);

				if (this.is(ZrTokenKind.Operator, "=")) {
					return this.mutateExpressionStatement(createIdentifier(token.value, ""));
				} else if (this.functionCallScope > 0 && this.is(ZrTokenKind.Special, ":")) {
					return this.parseStrictFunctionOption(token.value);
				} else {
					return this.parseCommandStatement(token);
				}
			}
		}

		if (isToken(token, ZrTokenKind.Identifier)) {
			assert(token.value);
			return createIdentifier(token.value);
		} else if (isToken(token, ZrTokenKind.PropertyAccess)) {
			let expr: Identifier | PropertyAccessExpression | ArrayIndexExpression = createIdentifier(token.value);
			for (const name of token.properties) {
				if (name.match("%d+")[0]) {
					expr = createArrayIndexExpression(expr, createNumberNode(tonumber(name)!));
				} else {
					expr = createPropertyAccessExpression(expr, createIdentifier(name));
				}
			}
			return expr;
		} else if (isToken(token, ZrTokenKind.Number)) {
			return createNumberNode(token.value);
		} else if (isToken(token, ZrTokenKind.Boolean)) {
			return createBooleanNode(token.value);
		} else if (isToken(token, ZrTokenKind.InterpolatedString)) {
			return this.parseInterpolatedString(token);
		} else if (isToken(token, ZrTokenKind.EndOfStatement)) {
			this.throwParserError(`Invalid EndOfStatement: '${token.value}' [${token.startPos}:${token.endPos}]`);
		} else if (isToken(token, ZrTokenKind.Option)) {
			return createOptionKey(token.value);
		}

		if (
			isToken(token, ZrTokenKind.Operator) &&
			Grammar.UnaryOperators.includes(token.value as UnaryOperatorsTokens)
		) {
			return createUnaryExpression(token.value, this.parseNextExpressionStatement());
		}

		this.parserError(
			`Unexpected '${token.value}' [${token.startPos}:${token.endPos}]`,
			ZrParserErrorCode.Unexpected,
		);
	}

	private parseVariableDeclaration(left: Identifier, flags: ZrNodeFlag = 0) {
		this.skipIf(ZrTokenKind.Operator, "=");
		this.isAssignmentExpression = true;
		const right = this.mutateExpressionStatement(this.parseNextExpressionStatement());
		this.isAssignmentExpression = false;

		if (!this.is(ZrTokenKind.EndOfStatement)) {
			this.parserError("';' expected.", ZrParserErrorCode.Unexpected, this.lexer.peek());
		}

		if (isAssignableExpression(right)) {
			// isAssignment
			const decl = createVariableDeclaration(left, right);
			decl.flags = flags;
			const statement = createVariableStatement(decl);
			return statement;
		} else {
			this.parserNodeError(
				`Cannot assign ${getFriendlyName(right)} to variable '${left.name}'`,
				ZrParserErrorCode.InvalidVariableAssignment,
				right,
			);
		}
	}

	private isAssignmentExpression = false;
	/**
	 * Mutates expression statements if required
	 *
	 * If the expression is a binary expression, it will mutate the expression accordingly
	 */
	private mutateExpressionStatement(left: ExpressionStatement, precedence = 0): ExpressionStatement {
		const token = this.get(ZrTokenKind.Operator);
		if (token) {
			const otherPrecedence = Grammar.OperatorPrecedence[token.value];
			if (otherPrecedence > precedence) {
				this.lexer.next();

				if (token.value === "=") {
					if (!isNode(left, ZrNodeKind.Identifier)) {
						this.parserError("Unexpected '='", ZrParserErrorCode.Unexpected, token);
					}
					return this.parseVariableDeclaration(left);
				} else {
					return createBinaryExpression(
						left,
						token.value,
						this.mutateExpressionStatement(this.parseNextExpressionStatement()),
					);
				}
			}
		}

		return left;
	}

	/**
	 * Parse the next expression
	 */
	private parseNextExpression() {
		const expr = this.parseNextExpressionStatement();
		return this.mutateExpressionStatement(expr);
	}

	private isNextEndOfStatement() {
		return this.is(ZrTokenKind.EndOfStatement, ";") || this.is(ZrTokenKind.EndOfStatement, "\n");
	}

	private skipNextEndOfStatement() {
		if (this.isNextEndOfStatement()) {
			this.lexer.next();
		} else {
			this.parserError("Expected end of statement", ZrParserErrorCode.Unexpected);
		}
	}

	private skipAllWhitespace() {
		while (this.lexer.hasNext() && this.isNextEndOfStatement()) {
			this.skipNextEndOfStatement();
		}
	}

	/**
	 * Parse source code
	 */
	private parseSource(start?: string, stop?: string) {
		const source = new Array<Node>();

		if (start) {
			this.skip(ZrTokenKind.Special, start);
		}

		this.skipAllWhitespace();

		while (this.lexer.hasNext()) {
			if (stop && this.is(ZrTokenKind.Special, stop)) {
				break;
			}

			const expression = this.parseNextExpression();
			source.push(expression);

			if (stop && this.is(ZrTokenKind.Special, stop)) {
				break;
			}

			this.skipAllWhitespace();
		}

		this.skipAllWhitespace();

		if (stop) {
			this.skip(ZrTokenKind.Special, stop);
		}

		return source;
	}

	public parseOrThrow() {
		return createCommandSource(this.parseSource());
	}

	public parse() {
		try {
			return createCommandSource(this.parseSource());
		} catch (e) {
			warn(e);
			return createCommandSource([]);
		}
	}

	public getErrors(): readonly ParserError[] {
		return this.errors;
	}

	public hasErrors() {
		return this.errors.size() > 0;
	}
}
