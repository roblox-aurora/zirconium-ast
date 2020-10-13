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
	createPropertyAccessExpression,
	createStringNode,
	createVariableDeclaration,
	createVariableStatement,
} from "Nodes/Create";
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
import { InterpolatedStringToken, isToken, StringToken, TokenTypes, ZrTokenKind } from "Tokens/Tokens";
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

export default class ZrParser {
	private preventCommandParsing = false;
	private strict = false;
	public constructor(private lexer: ZrLexer) {}

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
			throw `Invalid ${this.lexer.peek()?.kind} '${this.lexer.peek()?.value}', expected ${kind} '${value}'`;
		}
	}

	private parseBlock() {
		if (this.is(ZrTokenKind.Special, "{")) {
			const block = this.parseSource("{", "}") as Statement[];
			return createBlock(block);
		} else {
			throw `Can't parse block :(`;
		}
	}

	private parseIfStatement() {
		this.skip(ZrTokenKind.Keyword, "if");
		const node = createIfStatement(this.parseNextExpression(), undefined, undefined);

		if (this.is(ZrTokenKind.Special, "{")) {
			node.thenStatement = this.parseBlock();
		}

		if (this.is(ZrTokenKind.Keyword, "else")) {
			this.lexer.next();
			if (this.is(ZrTokenKind.Special, "{")) {
				node.elseStatement = this.parseBlock();
			}
		}

		return node;
	}

	private isOperatorToken() {
		return this.is(ZrTokenKind.Operator);
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
		while (this.lexer.hasNext() && !this.isNextEndOfStatement() && !this.isOperatorToken()) {
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

			prettyPrintNodes(values, "arrayExpression");
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
	private parseNextExpressionStatement() {
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
					this.throwParserError("Cannot have non-quoted string in strict mode!");
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
		}

		this.throwParserError(
			`Unable to generate ExpressionStatement from tokenKind {kind: ${token.kind}, value: ${token.value}} (${
				token.value.byte()[0]
			})`,
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
					const right = this.mutateExpressionStatement(this.parseNextExpressionStatement());
					if (isAssignableExpression(right)) {
						// isAssignment
						return createVariableStatement(createVariableDeclaration(left, right));
					} else {
						this.throwParserError(`Cannot assign ${right.kind} to VariableStatement`);
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
			const token = this.lexer.peek();
			throw `Expected end of statement (newline or ';'), got ${token?.kind}`;
		}
	}

	private skipAllWhitespace() {
		while (this.lexer.hasNext() && this.isNextEndOfStatement()) {
			print("skip", this.lexer.peek()?.kind ?? "none");
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

		if (stop) {
			this.skip(ZrTokenKind.Special, stop);
		}

		return source;
	}

	public parse() {
		// this.lexer.reset();
		return createCommandSource(this.parseSource());
	}
}
