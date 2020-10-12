import ZrLexer from "Lexer";
import {
	createBinaryExpression,
	createCommandSource,
	createIdentifier,
	createIfStatement,
	createNumberNode,
	createOperator,
	createStringNode,
} from "Nodes/Create";
import { ExpressionStatement, Node, NodeError, OperatorToken, Statement } from "Nodes/NodeTypes";
import { isToken, ZrTokenKind } from "Tokens/Tokens";

const OPERATOR_PRECEDENCE: Record<string, number> = {
	"=": 1,
	"||": 2,
	"&&": 3,
	"<": 7,
	">": 7,
	">=": 7,
	"<=": 7,
	"==": 7,
	"!=": 7,
	"+": 10,
	"-": 10,
	"*": 20,
	"/": 20,
	"%": 20,
};

export default class ZrParser {
	private errors = new Array<NodeError>();
	public constructor(private lexer: ZrLexer) {}

	private peekLexer() {
		return this.lexer.peek();
	}

	private is(kind: ZrTokenKind, value?: string | number | boolean) {
		const token = this.lexer.peek();
		if (value !== undefined) {
			return token !== undefined && token.kind === kind && token.value === value;
		} else {
			return token !== undefined && token.kind === kind;
		}
	}

	public get(kind: ZrTokenKind, value?: string | number | boolean) {
		return this.is(kind, value) ? this.lexer.peek()! : undefined;
	}

	private skip(kind: ZrTokenKind, value: string | number | boolean) {
		if (this.is(kind, value)) {
			this.lexer.next();
		} else {
			throw `Invalid ${this.lexer.peek()?.kind}, expected ${kind}`;
		}
	}

	private parseBlock() {
		// const source = this.parseSource("{", "}");
	}

	private parseIfStatement() {
		this.skip(ZrTokenKind.Keyword, "if");
		const node = createIfStatement(this.parseExpression(), undefined, undefined);
	}

	private parseExpressionStatement() {
		const nextNode = this.lexer.peek();
		print("parseExpressionStatement", nextNode?.kind, nextNode?.value);

		if (this.is(ZrTokenKind.Keyword, "if")) {
			// return this.parseIfStatement();
		}

		// Handle literals
		const next = this.lexer.next();
		assert(next);
		if (isToken(next, ZrTokenKind.Identifier)) {
			return createIdentifier(next.value);
		} else if (isToken(next, ZrTokenKind.Number)) {
			return createNumberNode(next.value);
		} else if (isToken(next, ZrTokenKind.String)) {
			return createStringNode(next.value, next.quotes);
		}

		throw `Invalid tokenKind ${next.kind} '${next.value}' (${next.value.byte()[0]})`;
	}

	private mutateExpressionStatement(left: ExpressionStatement, precedence = 0): ExpressionStatement {
		const token = this.get(ZrTokenKind.Operator);
		if (token && isToken(token, ZrTokenKind.Operator)) {
			const otherPrecedence = OPERATOR_PRECEDENCE[token.value];
			if (otherPrecedence > precedence) {
				print("createBInary");
				this.lexer.next();
				return createBinaryExpression(
					left,
					createOperator(token.value),
					this.mutateExpressionStatement(this.parseExpressionStatement()),
				);
			}
		}

		return left;
	}

	private parseExpression() {
		return this.mutateExpressionStatement(this.parseExpressionStatement());
	}

	private isEndOfStatement() {
		return this.is(ZrTokenKind.Special, ";") || this.is(ZrTokenKind.Special, "\n");
	}

	private skipEndOfStatement() {
		if (this.isEndOfStatement()) {
			this.lexer.next();
		} else {
			const token = this.lexer.peek();
			throw `Expected end of statement (newline or ';'), got ${token?.kind}`;
		}
	}

	/**
	 * Parse source code
	 */
	private parseSource() {
		const source = new Array<Node>();

		while (this.lexer.hasNext()) {
			// Skip out ';' and '\n'
			if (this.isEndOfStatement()) {
				this.skipEndOfStatement();
			}

			const next = this.lexer.peek();
			print(next?.kind, next?.value);

			const expression = this.parseExpression();
			source.push(expression);

			while (this.lexer.hasNext() && this.isEndOfStatement()) {
				print("skip", this.lexer.peek()?.kind);
				this.skipEndOfStatement();
			}
		}

		return source;
	}

	public parse() {
		// this.lexer.reset();
		return createCommandSource(this.parseSource());
	}
}
