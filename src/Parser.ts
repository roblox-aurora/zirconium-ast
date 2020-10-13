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
	createIdentifier,
	createIfStatement,
	createInterpolatedString,
	createNumberNode,
	createOperator,
	createOptionExpression,
	createOptionKey,
	createParenthesizedExpression,
	createPropertyAccessExpression,
	createStringNode,
	createVariableDeclaration,
	createVariableStatement,
} from "Nodes/Create";
import { getFriendlyName } from "Nodes/Functions";
import { isAssignableExpression } from "Nodes/Guards";
import {
	ArrayIndexExpression,
	ExpressionStatement,
	Identifier,
	Node,
	NodeError,
	PropertyAccessExpression,
	Statement,
	StringLiteral,
} from "Nodes/NodeTypes";
import { InterpolatedStringToken, isToken, StringToken, Token, TokenTypes, ZrTokenKind } from "Tokens/Tokens";
import { prettyPrintNodes } from "Utility";

const OPERATOR_PRECEDENCE: Record<string, number> = {
	"=": 1,
	"|": 2,
	"||": 2,
	"&&": 3,
	"<": 7,
	">": 7,
	">=": 7,
	"<=": 7,
	"==": 7,
	"!=": 7,
	//"+": 10,
	//"-": 10,
	//"*": 20,
	//"/": 20,
	//"%": 20,
};

interface ZrParserOptions {
	commands: AstCommandDefinitions;
}

export const enum ZrParserErrorCode {
	Unexpected = 1000,
	UnexpectedWord = 1001,
	InvalidVariableAssignment = 1002,
}

export interface ParserError {
	message: string;
	code: ZrParserErrorCode;
	node?: Node;
	token?: Token;
}

export default class ZrParser {
	private preventCommandParsing = false;
	private strict = false;
	private isAssigning = false;
	private errors = new Array<ParserError>();

	public constructor(private lexer: ZrLexer, private options: ZrParserOptions) {}

	private parserError(message: string, code: ZrParserErrorCode): never {
		this.errors.push(
			identity<ParserError>({
				message,
				code,
			}),
		);
		this.throwParserError(message);
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
	private skip(kind: ZrTokenKind, value: string | number | boolean) {
		if (this.is(kind, value)) {
			this.lexer.next();
		} else {
			this.parserError("Unexpected '" + kind + "'", ZrParserErrorCode.Unexpected);
		}
	}

	private parseBlock() {
		if (this.is(ZrTokenKind.Special, "{")) {
			const block = this.parseSource("{", "}") as Statement[];
			return createBlock(block);
		} else {
			this.parserError("Code block does not start with a '{'", ZrParserErrorCode.Unexpected);
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

		if (this.is(ZrTokenKind.Special, "{")) {
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
		return this.is(ZrTokenKind.Operator);
	}

	private isBracketToken() {
		return this.is(ZrTokenKind.Special, ")") || this.is(ZrTokenKind.Special, "{");
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

		let argumentIndex = 0;
		while (
			this.lexer.hasNext() &&
			!this.isNextEndOfStatement() &&
			!this.isOperatorToken() &&
			!this.isBracketToken()
		) {
			if (isStrictFunctionCall && this.is(ZrTokenKind.Special, ")")) {
				break;
			}

			if (isStrictFunctionCall && argumentIndex > 0) {
				this.skip(ZrTokenKind.Special, ",");
			}

			this.preventCommandParsing = true;
			nodes.push(this.parseNextExpression());
			this.preventCommandParsing = false;
			argumentIndex++;
		}

		if (isStrictFunctionCall) {
			this.skip(ZrTokenKind.Special, ")");
			this.strict = false;
		}

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

	private parseArrayExpression(start = "[", stop = "]", separator = ",") {
		const values = new Array<Node>();
		let index = 0;

		this.skip(ZrTokenKind.Special, start);
		this.preventCommandParsing = true;

		while (this.lexer.hasNext()) {
			if (this.is(ZrTokenKind.Special, stop)) {
				break;
			}

			if (index > 0 && (this.is(ZrTokenKind.Special, separator) || this.strict)) {
				this.skip(ZrTokenKind.Special, separator);
			}

			values.push(this.parseNextExpressionStatement());

			index++;
		}

		this.preventCommandParsing = false;
		this.skip(ZrTokenKind.Special, stop);

		return createArrayLiteral(values);
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

		if (this.is(ZrTokenKind.Special, "{")) {
			return this.parseBlock();
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
		print(token.kind, token.value);

		if (isToken(token, ZrTokenKind.String)) {
			if (this.preventCommandParsing || token.quotes !== undefined) {
				if (this.strict && token.quotes === undefined) {
					this.parserError("Unexpected '" + token.value + "'", ZrParserErrorCode.UnexpectedWord);
				}

				return createStringNode(token.value, token.quotes);
			} else if (token.value !== "") {
				assert(token.value.match("[%w_.]+")[0], `Invalid command expression: '${token.value}'`);
				return this.parseCommandStatement(token);
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

		this.parserError(
			`Unexpected '${token.value}' [${token.startPos}:${token.endPos}]`,
			ZrParserErrorCode.Unexpected,
		);
	}

	/**
	 * Mutates expression statements if required
	 *
	 * If the expression is a binary expression, it will mutate the expression accordingly
	 */
	private mutateExpressionStatement(left: ExpressionStatement, precedence = 0): ExpressionStatement {
		const token = this.get(ZrTokenKind.Operator);
		if (token) {
			const otherPrecedence = OPERATOR_PRECEDENCE[token.value];
			if (otherPrecedence > precedence) {
				this.lexer.next();

				if (token.value === "=" && isNode(left, ZrNodeKind.Identifier)) {
					this.isAssigning = true;
					const right = this.mutateExpressionStatement(this.parseNextExpressionStatement());
					if (isAssignableExpression(right)) {
						// isAssignment
						const statement = createVariableStatement(createVariableDeclaration(left, right));
						this.isAssigning = false;
						return statement;
					} else {
						this.isAssigning = false;
						this.parserNodeError(
							`Cannot assign ${getFriendlyName(right)} to variable '${left.name}'`,
							ZrParserErrorCode.InvalidVariableAssignment,
							right,
						);
					}
				} else {
					return createBinaryExpression(
						left,
						createOperator(token.value),
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
		return this.mutateExpressionStatement(this.parseNextExpressionStatement());
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

	public parse() {
		// this.lexer.reset();
		return createCommandSource(this.parseSource());
	}

	public getErrors(): readonly ParserError[] {
		return this.errors;
	}

	public hasErrors() {
		return this.errors.size() > 0;
	}
}
