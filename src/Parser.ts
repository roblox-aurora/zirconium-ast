import { AstCommandDefinitions } from "Definitions/Definitions";
import ZrLexer from "Lexer";
import { ZrNodeKind, isNode } from "Nodes";
import {
	createArrayIndexExpression,
	createArrayLiteral,
	createBinaryExpression,
	createBlock,
	createBooleanNode,
	createCallExpression,
	createSourceFile,
	createExpressionStatement,
	createForInStatement,
	createFunctionDeclaration,
	createIdentifier,
	createIfStatement,
	createInterpolatedString,
	createKeywordTypeNode,
	createNumberNode,
	createObjectLiteral,
	createOptionExpression,
	createOptionKey,
	createParameter,
	createParenthesizedExpression,
	createPropertyAccessExpression,
	createPropertyAssignment,
	createSimpleCallExpression,
	createStringNode,
	createTypeReference,
	createUnaryExpression,
	createVariableDeclaration,
	createVariableStatement,
} from "Nodes/Create";
import { ZrNodeFlag, ZrTypeKeyword } from "Nodes/Enum";
import { getFriendlyName } from "Nodes/Functions";
import { isAssignableExpression, isOptionExpression } from "Nodes/Guards";
import {
	ArrayIndexExpression,
	CallExpression,
	Expression,
	Identifier,
	Node,
	OptionExpression,
	ParameterDeclaration,
	PropertyAccessExpression,
	PropertyAssignment,
	SimpleCallExpression,
	Statement,
	StringLiteral,
} from "Nodes/NodeTypes";
import Grammar, { OperatorTokens, UnaryOperatorsTokens } from "Tokens/Grammar";
import {
	IdentifierToken,
	InterpolatedStringToken,
	isToken,
	OperatorToken,
	PropertyAccessToken,
	StringToken,
	Token,
	TokenTypes,
	ZrTokenKind,
} from "Tokens/Tokens";

export const enum ZrParserErrorCode {
	Unexpected = 1001,
	UnexpectedWord,
	InvalidVariableAssignment,
	IdentifierExpected,
	ExpectedToken,
	NotImplemented,
	ExpressionExpected,
}

interface FunctionCallContext {
	strict: boolean;
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
	private strict = false;
	private callContext = new Array<FunctionCallContext>();
	private errors = new Array<ParserError>();
	private warnings = new Array<ParserWarning>();

	public constructor(private lexer: ZrLexer) {}

	private getCurrentCallContext(): FunctionCallContext | undefined {
		return this.callContext[this.callContext.size() - 1];
	}

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
			this.parserError(
				message ?? "Expected '" + value + "' got '" + node?.value + "'",
				ZrParserErrorCode.Unexpected,
				node,
			);
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
			return createBlock([this.mutateStatement(this.parseNext()) as Statement]);
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
		const parameters = new Array<ParameterDeclaration>();
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
					const expression = this.mutateExpression(this.parseExpression());
					if (
						isNode(expression, ZrNodeKind.CallExpression) ||
						isNode(expression, ZrNodeKind.SimpleCallExpression) ||
						isNode(expression, ZrNodeKind.ArrayLiteralExpression) ||
						isNode(expression, ZrNodeKind.ObjectLiteralExpression) ||
						isNode(expression, ZrNodeKind.ArrayIndexExpression) ||
						isNode(expression, ZrNodeKind.ParenthesizedExpression)
					) {
						return createForInStatement(
							createIdentifier(id.value),
							expression,
							this.parseBlockOrInlineStatement(),
						);
					} else {
						this.parserError(
							"ForIn statement expects a valid expression",
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

		const expr = this.mutateExpression(this.parseExpression());
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
			this.is(ZrTokenKind.Special, ")") || this.is(ZrTokenKind.Special, "]") || this.is(ZrTokenKind.Special, "}")
			// this.is(ZrTokenKind.Special, ":")
		);
	}

	private functionCallScope = 0;
	private parseCallExpression(token: StringToken, isStrictFunctionCall = this.strict) {
		this.functionCallScope += 1;
		const callee = createIdentifier(token.value);

		const options = new Array<OptionExpression>();
		const args = new Array<Expression>();

		// Enable 'strict' function-like calls e.g. `kill(vorlias)` vs `kill vorlias`
		if (this.is(ZrTokenKind.Special, "(") || isStrictFunctionCall) {
			this.skip(ZrTokenKind.Special, "(");
			isStrictFunctionCall = true;
			this.strict = true;
			this.callContext.push({ strict: true });
		} else {
			this.callContext.push({ strict: false });
		}

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

			const arg = this.mutateExpression(this.parseExpression());
			if (isOptionExpression(arg)) {
				options.push(arg);
			} else {
				print("parseArg", ZrNodeKind[arg.kind]);
				args.push(arg);
			}

			argumentIndex++;
		}

		if (isStrictFunctionCall) {
			this.skip(ZrTokenKind.Special, ")");
			this.strict = false;
		}

		this.callContext.pop();

		let result: CallExpression | SimpleCallExpression;

		if (isStrictFunctionCall) {
			result = createCallExpression(callee, args, options);
		} else {
			result = createSimpleCallExpression(callee, args);
		}

		this.functionCallScope -= 1;
		return result;
	}

	/**
	 * Handles the parsing of a `InterpolatedStringToken`
	 * @param token The `InterpolatedStringToken`
	 * @returns the InterpolatedStringExpression
	 */
	private parseInterpolatedString(token: InterpolatedStringToken) {
		const { values, variables } = token;
		const resulting = new Array<StringLiteral | Identifier>();
		for (let k = 0; k < values.size(); k++) {
			const v = values[k];
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
		this.preventCommandParsing = false;

		const functionContext = this.getCurrentCallContext();

		while (this.lexer.hasNext()) {
			if (this.is(ZrTokenKind.Special, stop)) {
				break;
			}

			if (this.skipIf(ZrTokenKind.EndOfStatement, "\n")) {
				continue;
			}

			if (index > 0 && (this.is(ZrTokenKind.Special, separator) || (functionContext && functionContext.strict))) {
				this.skip(ZrTokenKind.Special, separator);
			}

			this.skipIf(ZrTokenKind.EndOfStatement, "\n");

			values.push(next());

			index++;
		}

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
			const expression = this.parseExpression();
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
		const values = this.parseListExpression("[", "]", () => this.parseExpression(), undefined, true);
		return createArrayLiteral(values);
	}

	private parsePropertyAccess(token: PropertyAccessToken) {
		let expr: Identifier | PropertyAccessExpression | ArrayIndexExpression = createIdentifier(token.value);
		for (const name of token.properties) {
			if (name.match("%d+")[0]) {
				expr = createArrayIndexExpression(expr, createNumberNode(tonumber(name)!));
			} else {
				expr = createPropertyAccessExpression(expr, createIdentifier(name));
			}
		}
		return expr;
	}

	private parseStrictFunctionOption(option: string) {
		this.skip(ZrTokenKind.Special, ":");
		return createOptionExpression(createOptionKey(option), this.mutateExpression(this.parseExpression()));
	}

	private parseExpression(token?: Token): Expression {
		if (this.is(ZrTokenKind.Special, "{")) {
			return this.parseObjectExpression();
		}

		if (this.is(ZrTokenKind.Special, "[")) {
			return this.parseArrayExpression();
		}

		// Handle literals
		token = token ?? this.lexer.next();
		assert(token, "No token found: " + this.lexer.peek()?.kind);

		if (isToken(token, ZrTokenKind.String)) {
			if (this.preventCommandParsing || token.quotes !== undefined) {
				if (this.strict && token.quotes === undefined) {
					this.parserError("Unexpected '" + token.value + "'", ZrParserErrorCode.UnexpectedWord);
				}

				return createStringNode(token.value, token.quotes);
			} else if (token.value !== "") {
				assert(token.value.match("[%w_.]+")[0], `Invalid command expression: '${token.value}'`);
				const context = this.getCurrentCallContext();

				if (this.functionCallScope > 0 && this.is(ZrTokenKind.Special, ":") && context?.strict) {
					return this.parseStrictFunctionOption(token.value);
				}

				const result = this.parseCallExpression(token);
				return result;
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
			return createUnaryExpression(token.value, this.parseNextStatement());
		}

		// Handle parenthesized expression
		if (isToken(token, ZrTokenKind.Special) && token.value === "(") {
			const expr = createParenthesizedExpression(this.mutateExpression(this.parseExpression()));
			this.skip(ZrTokenKind.Special, ")");
			return expr;
		}

		this.parserError(
			`Unexpected '${token.value}' [${token.startPos}:${token.endPos}] FFS`,
			ZrParserErrorCode.Unexpected,
		);
	}

	/**
	 * Parses the next expression statement
	 */
	private parseNextStatement(): Statement {
		if (this.is(ZrTokenKind.Keyword, "function")) {
			return this.parseFunction();
		}

		if (this.is(ZrTokenKind.Keyword, "for")) {
			return this.parseFor();
		}

		if (this.is(ZrTokenKind.Special, "{")) {
			return this.parseBlock();
		}

		if (this.is(ZrTokenKind.Keyword, "if")) {
			return this.parseIfStatement();
		}

		if (this.is(ZrTokenKind.Identifier)) {
			const id = this.get(ZrTokenKind.Identifier);
			assert(id);
			this.lexer.next();
			if (this.is(ZrTokenKind.Operator, "=")) {
				return this.parseVariableDeclaration(createIdentifier(id.value));
			} else {
				return createExpressionStatement(createIdentifier(id.value));
			}
		}

		if (this.is(ZrTokenKind.PropertyAccess)) {
			const id = this.get(ZrTokenKind.PropertyAccess);
			assert(id);
			this.lexer.next();
			if (this.is(ZrTokenKind.Operator, "=")) {
				return this.parseVariableDeclaration(this.parsePropertyAccess(id));
			} else {
				return createExpressionStatement(this.parsePropertyAccess(id));
			}
		}

		const token = this.lexer.next();
		assert(token);

		// if (isToken(token, ZrTokenKind.Identifier)) {
		// 	return this.parseVariableDeclaration(createIdentifier(token.value));
		// }

		// This passes the token directly, since in this case the expressions statement is part of our statement
		// generation code anyway.
		return createExpressionStatement(this.mutateExpression(this.parseExpression(token)));
	}

	private parseVariableDeclaration(
		left: Identifier | PropertyAccessExpression | ArrayIndexExpression,
		flags: ZrNodeFlag = 0,
	) {
		this.skipIf(ZrTokenKind.Operator, "=");
		const right = this.mutateExpression(this.parseExpression());

		if (isAssignableExpression(right)) {
			// isAssignment
			const decl = createVariableDeclaration(left, right);
			decl.flags = flags;
			const statement = createVariableStatement(decl);
			return statement;
		} else {
			this.parserNodeError(
				`Cannot assign ${getFriendlyName(right)} to variable '${left.kind}'`,
				ZrParserErrorCode.InvalidVariableAssignment,
				right,
			);
		}
	}

	private mutateExpression(left: Expression, precedence = 0): Expression {
		const token = this.get(ZrTokenKind.Operator);
		if (token) {
			const otherPrecedence = Grammar.OperatorPrecedence[token.value];
			if (otherPrecedence > precedence) {
				this.lexer.next();

				if (token.value === "=") {
					this.parserError("Unexpected '='", ZrParserErrorCode.Unexpected, token);
				}

				return createBinaryExpression(left, token.value, this.mutateExpression(this.parseExpression()));
			}
		}

		return left;
	}

	/**
	 * Mutates expression statements if required
	 *
	 * If the expression is a binary expression, it will mutate the expression accordingly
	 */
	private mutateStatement(left: Statement, precedence = 0): Statement {
		const token = this.get(ZrTokenKind.Operator);
		if (token) {
			const otherPrecedence = Grammar.OperatorPrecedence[token.value];
			if (otherPrecedence > precedence) {
				this.lexer.next();

				if (token.value === "=") {
					if (!isNode(left, ZrNodeKind.Identifier) && !isNode(left, ZrNodeKind.PropertyAccessExpression)) {
						this.parserError(
							"Unexpected '=' (Assignment to " + ZrNodeKind[left.kind] + ")",
							ZrParserErrorCode.Unexpected,
							token,
						);
					}
					return this.parseVariableDeclaration(left);
				}
			}
		}

		return left;
	}

	/**
	 * Parse the next expression
	 */
	private parseNext() {
		const expr = this.parseNextStatement();
		return this.mutateStatement(expr);
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
		const source = new Array<Statement>();

		if (start) {
			this.skip(ZrTokenKind.Special, start);
		}

		this.skipAllWhitespace();

		while (this.lexer.hasNext()) {
			if (stop && this.is(ZrTokenKind.Special, stop)) {
				break;
			}

			const statement = this.parseNext();
			source.push(statement);

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
		return createSourceFile(this.parseSource());
	}

	public parse() {
		try {
			return createSourceFile(this.parseSource());
		} catch (e) {
			warn(e);
			return createSourceFile([]);
		}
	}

	public getErrors(): readonly ParserError[] {
		return this.errors;
	}

	public hasErrors() {
		return this.errors.size() > 0;
	}
}
