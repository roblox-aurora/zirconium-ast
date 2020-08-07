/* eslint-disable roblox-ts/lua-truthiness */
import {
	Node,
	CmdSyntaxKind,
	createCommandStatement,
	createCommandName,
	createStringNode,
	isNode,
	createNumberNode,
	createOption,
	createIdentifier,
	createOperator,
	createBinaryExpression,
	createInterpolatedString,
	InterpolatedStringExpression,
	StringLiteral,
	getKindName,
	createCommandSource,
	CommandSource,
	createBooleanNode,
	createEndOfStatementNode,
	isValidPrefixCharacter,
	createPrefixToken,
	createPrefixExpression,
	createVariableStatement,
	createVariableDeclaration,
	getNodeKindName,
	isNodeIn,
	createInvalidNode,
	NodeError,
	NodeFlag,
	createNodeError,
	createInnerExpression,
	shiftNodes,
} from "./Nodes";
import { ValidationResult } from "./Validation";

const enum OperatorLiteralToken {
	AndAsync = "&",
	And = "&&",
	Pipe = "|",
}

const enum TOKEN {
	SPACE = " ",
	NEWLINE = "\n",
	CARRIAGE_RETURN = "\\r",
	DOUBLE_QUOTE = '"',
	SINGLE_QUOTE = "'",
	DASH = "-",
	END = ";",
	VARIABLE = "$",
	HASH = "#",
	BACKQUOTE = "`",
	BACKSLASH = "\\",
}

interface ParserOptions {
	variables: boolean;
	options: boolean;
	operators: boolean;
	kebabArgumentsToCamelCase: boolean;
	interpolatedStrings: boolean;

	/** @experimental */
	variableDeclarations: boolean;
	/** @experimental */
	prefixExpressions: boolean;
	/** @experimental */
	innerExpressions: boolean;
	/** @experimental */
	nestingInnerExpressions: boolean;
	/** @experimental */
	maxNestedInnerExpressions: number;
}

const DEFAULT_PARSER_OPTIONS: ParserOptions = {
	variables: true,
	options: true,
	prefixExpressions: false,
	variableDeclarations: false,
	innerExpressions: false,
	nestingInnerExpressions: false,
	operators: true,
	interpolatedStrings: true,
	kebabArgumentsToCamelCase: true,
	maxNestedInnerExpressions: 1,
};

interface NodeCreationOptions {
	quotes?: string;
	startPos?: number;
	endPos?: number;
	isUnterminated?: boolean;
}

export default class CommandAstParser {
	private ptr = 0;
	private childNodes = new Array<Node>();
	private nodes = new Array<Node>();
	private tokens = "";
	private raw: string;
	private escaped = false;
	public readonly errors = new Array<string>();
	private options: ParserOptions;

	constructor(raw: string, options?: Partial<ParserOptions>) {
		this.raw = raw;
		this.options = { ...DEFAULT_PARSER_OPTIONS, ...options };
	}

	private next(offset = 0) {
		return this.raw.sub(this.ptr + offset, this.ptr + offset);
	}

	private nextMatch(value: string, offset = 0) {
		return this.raw.sub(this.ptr + offset, this.ptr + offset + value.size() - 1) === value;
	}

	private pop(offset = 1) {
		const value = this.next();
		this.ptr += offset;
		return value;
	}

	private pushChildNode(node: Node | undefined) {
		node !== undefined && this.childNodes.push(node);
	}

	public popChildNode(offset = 1) {
		const excludedNodes = this.childNodes.slice(this.childNodes.size() - 1 - offset, this.childNodes.size() - 1);
		this.childNodes = [...this.childNodes.slice(0, this.childNodes.size() - offset)];
		return excludedNodes;
	}

	/**
	 * create and return a node from the read tokens
	 */
	private createNodeFromTokens(options?: NodeCreationOptions) {
		let node: Node | undefined;
		// ensure non-empty, should skip whitespace
		if (this.tokens !== "") {
			if (this.tokens.match("^%d+$")[0] !== undefined) {
				node = createNumberNode(tonumber(this.tokens)!);
				node.pos = this.ptr - this.tokens.size() - 1;
				node.endPos = this.ptr - 1;
				node.rawText = this.tokens;
			} else if (this.tokens === "true" || this.tokens === "false") {
				node = createBooleanNode(this.tokens === "true");
				node.pos = this.ptr - this.tokens.size() - 1;
				node.endPos = this.ptr - 1;
				node.rawText = this.tokens;
			} else {
				node = createStringNode(this.tokens, options?.quotes);
				node.isUnterminated = options?.isUnterminated;

				if (options?.startPos !== undefined) {
					node.pos = options.startPos;
				} else {
					node.pos = this.ptr - this.tokens.size();
				}

				if (options?.endPos !== undefined) {
					node.endPos = options.endPos;
				} else {
					node.endPos = this.ptr - 1;
				}

				node.rawText = this.raw.sub(node.pos, node.endPos);
			}

			this.tokens = "";
		}

		return node;
	}

	private getNodeAt(offset = 0, nodes = this.nodes) {
		if (offset < 0) {
			return nodes[this.nodes.size() + offset];
		} else {
			return nodes[offset];
		}
	}

	/**
	 * appends a statement node to the CommandSource
	 *
	 * ### CommandStatement
	 * `cmd [--options ...] [arg1 arg2 ...]`
	 * ### VariableDeclarationStatement
	 * `$var = [expression]`
	 */
	private appendStatementNode(startPos = 0, endPos = 0) {
		this.pushChildNode(this.createNodeFromTokens());

		// If we have child nodes, we'll work with what we have...
		if (this.childNodes.size() > 0) {
			const firstNode = this.getNodeAt(0, this.childNodes);

			if (isNode(firstNode, CmdSyntaxKind.String) && !firstNode.quotes) {
				this.childNodes.push(createEndOfStatementNode());

				const nameNode = createCommandName(firstNode);
				this.childNodes[0] = nameNode;

				// Do final statement "combining" actions
				let i = 0;
				const childNodes = new Array<Node>();
				while (i < this.childNodes.size()) {
					const node = this.childNodes[i];
					if (isNode(node, CmdSyntaxKind.PrefixToken)) {
						const nextNode = this.childNodes[i + 1];
						if (
							isNodeIn(nextNode, [
								CmdSyntaxKind.String,
								CmdSyntaxKind.InterpolatedString,
								CmdSyntaxKind.Number,
								CmdSyntaxKind.Boolean,
							])
						) {
							childNodes.push(createPrefixExpression(node, nextNode));
						} else {
							if (nextNode === undefined) {
								throw `[CommandParser] Unexpected trailing PrefixToken`;
							}
							throw `[CommandParser] Unexpected ${getNodeKindName(nextNode)} after PrefixToken`;
						}
						i += 2;
					} else {
						childNodes.push(node);
						i++;
					}
				}
				this.childNodes = childNodes;

				const lastNode = this.getNodeAt(-1);
				if (isNode(lastNode, CmdSyntaxKind.OperatorToken)) {
					const prevNode = this.getNodeAt(-2);
					this.nodes = [
						...this.nodes.slice(0, this.nodes.size() - 2),
						createBinaryExpression(prevNode, lastNode, createCommandStatement(nameNode, this.childNodes)),
					];
				} else {
					const statement = createCommandStatement(nameNode, this.childNodes);
					statement.pos = startPos;
					statement.endPos = endPos;
					statement.rawText = this.raw.sub(startPos, endPos);
					this.nodes.push(statement);
				}
			} else if (isNode(firstNode, CmdSyntaxKind.Identifier) && this.options.variableDeclarations) {
				const nextNode = this.getNodeAt(1, this.childNodes);
				if (isNode(nextNode, CmdSyntaxKind.OperatorToken) && nextNode.operator === "=") {
					const expressionNode = this.getNodeAt(2, this.childNodes);
					if (expressionNode) {
						if (
							isNodeIn(expressionNode, [
								CmdSyntaxKind.String,
								CmdSyntaxKind.InterpolatedString,
								CmdSyntaxKind.Identifier,
								CmdSyntaxKind.Number,
								CmdSyntaxKind.Boolean,
								CmdSyntaxKind.CommandStatement,
							])
						) {
							this.nodes.push(
								createVariableStatement(createVariableDeclaration(firstNode, expressionNode)),
							);
						} else {
							// throw `[CommandParser] Unexpected assignment of ${getNodeKindName(
							// 	expressionNode,
							// )} to variable`;
						}
					} else {
						this.nodes.push(
							createInvalidNode(`Expression expected: '$${firstNode.name} ='`, [firstNode, nextNode]),
						);
						// throw `[CommandParser] Expression expected: '${firstNode.name} ='`;
					}
				} else {
					this.nodes.push(createInvalidNode(`Unexpected Identifier: ${firstNode.name}`, [firstNode]));
				}
			} else {
				// throw `[CommandParser] Expected valid CommandStatement or VariableStatement, cannot create command statement from ${getNodeKindName(
				// 	firstNode,
				// )}`;
				for (const childNode of this.childNodes) {
					childNode.flags = childNode.flags | NodeFlag.NodeHasError;
					this.nodes.push(childNode);
				}
			}

			this.childNodes = [];
		}
	}

	/**
	 * Parses long strings and interpolated strings
	 *
	 * `"Hello, World"` - Regular long string
	 *
	 * `"Hello $variable"` - Interpolated string
	 *
	 * @param quotes The type of quotes this string has
	 */
	private readLongString(quotes = TOKEN.DOUBLE_QUOTE) {
		let isInterpolated = false;
		const interpolated: InterpolatedStringExpression["values"] = [];

		const start = this.ptr - 1;

		while (this.ptr < this.raw.size()) {
			const char = this.next();

			if (
				char === TOKEN.VARIABLE &&
				this.options.interpolatedStrings &&
				this.options.variables &&
				!this.escaped
			) {
				isInterpolated = true;
				this.pop();

				const prev = this.createNodeFromTokens({
					quotes,
					startPos: this.ptr - this.tokens.size() - 1,
					endPos: this.ptr - 2,
				});
				prev && interpolated.push(prev as StringLiteral);

				const variable = this.parseVariable();
				variable && interpolated.push(variable);
				continue;
			} else if (char === "\\") {
				this.pop();
				this.escaped = true;
				continue;
			} else if (char === quotes && !this.escaped) {
				this.pop();

				if (isInterpolated) {
					const ending = this.createNodeFromTokens({
						quotes,
						startPos: this.ptr - this.tokens.size() - 1,
						endPos: this.ptr - 2,
					}) as StringLiteral;
					ending && interpolated.push(ending);

					const interpolatedNode = createInterpolatedString(...interpolated);
					interpolatedNode.pos = start;
					interpolatedNode.endPos = this.ptr - 1;
					interpolatedNode.rawText = this.raw.sub(start, this.ptr - 1);
					this.pushChildNode(interpolatedNode);
				} else {
					this.pushChildNode(this.createNodeFromTokens({ quotes, startPos: start, endPos: this.ptr - 1 }));
				}

				return true;
			}

			this.escaped = false;
			this.tokens += this.pop();
		}

		this.errors.push(`Unterminated StringLiteral:  ${this.raw.sub(start, this.ptr)}`);
		this.pushChildNode(
			this.createNodeFromTokens({ isUnterminated: true, quotes, startPos: start, endPos: this.ptr }),
		);
		this.childNodes[this.childNodes.size() - 1].flags = NodeFlag.NodeHasError;
		return false;
	}

	/**
	 * Parses comments
	 * - basically removes comments
	 */
	private parseComment() {
		while (this.ptr < this.raw.size()) {
			const char = this.next();
			if (char === "\n" || char === "\r") {
				break;
			}
			this.ptr++;
		}
	}

	/**
	 * Parses variables
	 *
	 * `$varName` - For use in InterpolatedStrings, as arguments, or as the variable in VariableDeclarationStatements
	 */
	private parseVariable() {
		const start = this.ptr - 1;
		while (this.ptr < this.raw.size()) {
			const char = this.next();
			if (char === TOKEN.SPACE || char.match("[%w_]")[0] === undefined) {
				if (this.tokens !== "") {
					const identifier = createIdentifier(this.tokens);
					identifier.pos = start;
					identifier.endPos = start + this.tokens.size();
					identifier.rawText = this.raw.sub(start, start + this.tokens.size());
					this.tokens = "";
					return identifier;
				} else {
					// throw `Invalid Variable Name: ${this.tokens}`;
				}
			}

			if (char.match("[%w_]")[0] !== undefined) {
				this.tokens += this.pop();
			} else {
				// throw `Variable cannot contain character: ${this.pop()}`;
			}
		}

		// In case it's last in the index
		if (this.tokens !== "") {
			const identifier = createIdentifier(this.tokens);
			identifier.pos = start;
			identifier.endPos = start + this.tokens.size();
			identifier.rawText = this.raw.sub(start, start + this.tokens.size());
			this.tokens = "";
			return identifier;
		}
	}

	/**
	 * Internal utility for turning options like `--example-option` into `exampleOption`
	 */
	private kebabCaseToCamelCase(str: string) {
		let result = "";
		let i = 0;
		while (i < str.size()) {
			const char = str.sub(i, i);
			if (char === "-") {
				const nextChar = str.sub(i + 1, i + 1);
				result += nextChar.upper();
				i++;
			} else {
				result += char;
			}
			i++;
		}
		return result;
	}

	/**
	 * Parses long-form option names
	 */
	private parseLongOptionName() {
		while (this.ptr < this.raw.size()) {
			const char = this.next();
			const valid = char.match("[%a%d_-]")[0];
			if (char === TOKEN.SPACE || valid === undefined) {
				if (this.tokens !== "") {
					if (this.options.kebabArgumentsToCamelCase) {
						this.tokens = this.kebabCaseToCamelCase(this.tokens);
					}

					this.childNodes.push(createOption(this.tokens));
					this.tokens = "";
				}
				break;
			}

			this.tokens += this.pop();
		}

		if (this.tokens !== "") {
			if (this.options.kebabArgumentsToCamelCase) {
				this.tokens = this.kebabCaseToCamelCase(this.tokens);
			}

			this.childNodes.push(createOption(this.tokens));
			this.tokens = "";
		}
	}

	private validateTree() {
		const lastNode = this.getNodeAt(-1);

		// Don't allow a trailing &
		if (isNode(lastNode, CmdSyntaxKind.OperatorToken)) {
			// throw `[CommandParser] Unexpected ${lastNode.operator}`;
		}
	}

	/**
	 * Parse short-form option names
	 */
	private parseOptionLetter() {
		while (this.ptr < this.raw.size()) {
			const char = this.next();
			if (char === TOKEN.SPACE || char.match("[%a_]")[0] === undefined) {
				break;
			}

			this.childNodes.push(createOption(this.pop()));
		}
	}

	public parseNestedCommand(escapeChar: string = TOKEN.BACKQUOTE) {
		let cmd = "";
		let nestLevel = 0;
		const start = this.ptr;
		while (this.ptr < this.raw.size()) {
			const char = this.next();

			if (char === escapeChar) {
				if (nestLevel === 0) {
					this.pop();
					const subCommand = new CommandAstParser(cmd, this.options).Parse().children[0];
					if (!isNodeIn(subCommand, [CmdSyntaxKind.CommandStatement])) {
						this.nodes.push(
							createInvalidNode(`Unexpected ${getNodeKindName(subCommand)} when parsing nested command`, [
								subCommand,
							]),
						);
					} else {
						const inner = createInnerExpression(subCommand);
						inner.pos = start;
						inner.endPos = start + cmd.size() - 1;
						inner.rawText = this.raw.sub(start, start + cmd.size() - 1);
						shiftNodes(inner.expression, start);
						return inner;
					}
				} else {
					nestLevel--;
				}
			} else if (escapeChar === ")" && char === "$" && this.next(1) === "(") {
				if (!this.options.nestingInnerExpressions || nestLevel >= this.options.maxNestedInnerExpressions) {
					// throw `[CommandParser] Exceeding maximum expression nesting level of ${this.options.maxNestedInnerExpressions}`;
				}
				nestLevel++;
			}

			this.pop();
			cmd += char;
		}

		// throw `[CommandParser] Unexpected end of source when parsing nested command`;
	}

	/**
	 * Parses the command source provided to this CommandAstParser
	 */
	public Parse(): CommandSource {
		let valid = true;
		let statementBegin = 0;
		while (this.ptr < this.raw.size()) {
			const char = this.next();
			if (char === TOKEN.END || char === "\n" || char === TOKEN.CARRIAGE_RETURN) {
				if (!this.escaped) {
					this.appendStatementNode(statementBegin, this.ptr - 1);
					statementBegin = this.ptr + 1;
				} else {
					this.pop();
					this.escaped = false;
				}

				this.pop();
				continue;
			} else if (char === "\\") {
				this.escaped = true;
				this.pop();
				continue;
			} else if (char === TOKEN.SPACE && !this.escaped) {
				this.pushChildNode(this.createNodeFromTokens());
				this.pop();
				continue;
			} else if (char === TOKEN.HASH) {
				this.parseComment();
				continue;
			} else if (this.options.variables && char === TOKEN.VARIABLE && !this.escaped && this.tokens === "") {
				this.pop();

				if (this.next() === "(" && this.options.innerExpressions) {
					this.pop();
					const subCommand = this.parseNestedCommand(")");
					this.pushChildNode(subCommand);
					continue;
				}

				const id = this.parseVariable();
				id && this.pushChildNode(id);
				continue;
			} else if (this.nextMatch(OperatorLiteralToken.And) && this.options.operators) {
				this.pop(2);
				this.appendStatementNode();
				this.nodes.push(createOperator(OperatorLiteralToken.And));
				continue;
			} else if (this.nextMatch(OperatorLiteralToken.Pipe) && this.options.operators) {
				this.pop();
				this.appendStatementNode();
				this.nodes.push(createOperator(OperatorLiteralToken.Pipe));
				continue;
			} else if (char === "=") {
				this.pop();
				this.pushChildNode(createOperator("="));
				continue;
			} else if (isValidPrefixCharacter(char) && this.options.prefixExpressions && !this.escaped) {
				this.pop();
				this.pushChildNode(createPrefixToken(char));
				continue;
			} else if (this.options.options && char === TOKEN.DASH && this.next(-1) === TOKEN.SPACE) {
				this.pop();
				if (this.next() === TOKEN.DASH) {
					this.pop();
					this.parseLongOptionName();
					continue;
				} else {
					this.parseOptionLetter();
					continue;
				}
			} else if (char === TOKEN.DOUBLE_QUOTE || char === TOKEN.SINGLE_QUOTE) {
				this.escaped = false;
				this.pop();
				valid = this.readLongString(char);
				continue;
			}

			this.tokens += this.pop();
			this.escaped = false;
		}

		if (valid) {
			this.pushChildNode(this.createNodeFromTokens());
		}

		this.appendStatementNode(statementBegin, this.ptr - 1);

		this.validateTree();
		const source = createCommandSource(this.nodes);
		source.pos = 0;
		source.endPos = this.ptr - 1;
		source.rawText = this.raw;
		return source;
	}

	public static validate(
		node: Node,
		children = new Array<Node>(),
		errorNodes = new Array<NodeError>(),
	): ValidationResult {
		if (isNode(node, CmdSyntaxKind.Source)) {
			for (const child of node.children) {
				if (isNodeIn(child, [CmdSyntaxKind.CommandStatement, CmdSyntaxKind.VariableStatement])) {
					this.validate(child, node.children, errorNodes);
				} else if (isNode(child, CmdSyntaxKind.Invalid)) {
					this.validate(child, [], errorNodes);
				} else {
					errorNodes.push(createNodeError(`${this.render(child)} is not a valid expression`, child));
				}
			}
		} else if (isNode(node, CmdSyntaxKind.CommandStatement)) {
			for (const child of node.children) {
				this.validate(child, node.children, errorNodes);
			}
		} else if (isNode(node, CmdSyntaxKind.VariableStatement)) {
			const {
				declaration: { expression, identifier },
			} = node;
			this.validate(identifier, [], errorNodes);
			this.validate(expression, [], errorNodes);
		} else if (isNode(node, CmdSyntaxKind.String)) {
			if ((node.flags & NodeFlag.NodeHasError) !== 0) {
				if (node.isUnterminated) {
					errorNodes.push(
						createNodeError(
							`Unterminated string: ${node.quotes ?? ""}${node.text} [${node.pos ?? 0}:${
								node.endPos ?? 0
							}]`,
							node,
						),
					);
				}
			}
		} else if (isNode(node, CmdSyntaxKind.Invalid)) {
			errorNodes.push(createNodeError(node.message, node));
		} else if ((node.flags & NodeFlag.NodeHasError) !== 0) {
			errorNodes.push(createNodeError(`Node Error ${getNodeKindName(node)}`, node));
		}
		if (errorNodes.size() > 0) {
			return { success: false, errorNodes };
		}

		return { success: true };
	}

	public static assert(node: Node) {
		const result = this.validate(node);
		if (!result.success) {
			const firstNode = result.errorNodes[0];
			throw `[CmdParser] [${firstNode.node.pos ?? 0}:${firstNode.node.endPos ?? 0}] ${firstNode.message}`;
		}
	}

	private static printProps(node: Node, prefix = "") {
		print(`${prefix} <typeof ${getKindName(node.kind)}>`);
		for (const [key, value] of Object.entries(node)) {
			if (key === "parent" || key === "kind") {
			} else if (key === "children" || key === "values") {
				print(`\t${prefix} ${key}: {`);
				for (const child of value as Node[]) {
					this.printProps(child, prefix + "\t");
				}
				print(`\t${prefix}}`);
			} else {
				if (typeIs(value, "table")) {
					print(`\t${prefix} ${key}: {`);
					this.printProps(value as Node, prefix + "\t");
					print(`\t${prefix}}`);
				} else {
					print(`\t${prefix}* ${key}: ${tostring(value)}`);
				}
			}
		}
	}

	public static prettyPrint2(nodes: Node[], prefix = "") {
		for (const node of nodes) {
			this.printProps(node);
		}
	}

	public static prettyPrint(nodes: Node[], prefix = "", verbose = false) {
		for (const node of nodes) {
			if (isNode(node, CmdSyntaxKind.CommandName)) {
				if (verbose) {
					print(
						prefix,
						CmdSyntaxKind[node.kind],
						node.name.text,
						`[${node.pos}:${node.endPos}]`,
						`'${node.rawText}'`,
					);
				} else {
					print(prefix, CmdSyntaxKind[node.kind], node.name.text);
				}
			} else if (isNode(node, CmdSyntaxKind.String)) {
				const str = node.quotes !== undefined ? `${node.quotes}${node.text}${node.quotes}` : `\`${node.text}\``;
				if (verbose) {
					print(prefix, getNodeKindName(node), str, `[${node.pos}:${node.endPos}]`, `{${node.rawText}}`);
				} else {
					print(prefix, CmdSyntaxKind[node.kind], str);
				}

				if (node.isUnterminated) {
					print(prefix, "Unterminated String");
				}
			} else if (isNode(node, CmdSyntaxKind.InnerExpression)) {
				if (verbose) {
					print(prefix, CmdSyntaxKind[node.kind], `'${node.rawText}'`, `[${node.pos}:${node.endPos}]`, "{");
				} else {
					print(prefix, CmdSyntaxKind[node.kind], "{");
				}

				this.prettyPrint([node.expression], prefix + "\t", verbose);

				print(prefix, "}");
			} else if (isNode(node, CmdSyntaxKind.CommandStatement)) {
				if (verbose) {
					print(prefix, CmdSyntaxKind[node.kind], `'${node.rawText}'`, `[${node.pos}:${node.endPos}]`, "{");
				} else {
					print(prefix, CmdSyntaxKind[node.kind], "{");
				}

				this.prettyPrint(node.children, prefix + "\t", verbose);
				print(prefix, "}");
			} else if (isNode(node, CmdSyntaxKind.Number) || isNode(node, CmdSyntaxKind.Boolean)) {
				if (verbose) {
					print(
						prefix,
						CmdSyntaxKind[node.kind],
						node.value,
						`'${node.rawText}'`,
						`[${node.pos}:${node.endPos}]`,
					);
				} else {
					print(prefix, CmdSyntaxKind[node.kind], node.value);
				}
			} else if (isNode(node, CmdSyntaxKind.Option)) {
				print(prefix, CmdSyntaxKind[node.kind], node.flag);
				this.prettyPrint([node.right!], prefix + "\t", verbose);
			} else if (isNode(node, CmdSyntaxKind.Identifier)) {
				if (verbose) {
					print(
						prefix,
						CmdSyntaxKind[node.kind],
						node.name,
						`'${node.rawText}'`,
						`[${node.pos}:${node.endPos}]`,
					);
				} else {
					print(prefix, CmdSyntaxKind[node.kind], node.name);
				}
			} else if (isNode(node, CmdSyntaxKind.OperatorToken)) {
				print(prefix, CmdSyntaxKind[node.kind], node.operator);
			} else if (isNode(node, CmdSyntaxKind.BinaryExpression)) {
				print(prefix, CmdSyntaxKind[node.kind], "{");
				// print(prefix + "\t", ".operator", `"${node.operator}"`);
				print(prefix + "\t", ".parent", getKindName(node.parent?.kind));
				this.prettyPrint([node.left, node.operator, node.right], prefix + "\t", verbose);
				print(prefix, "}");
			} else if (isNode(node, CmdSyntaxKind.InterpolatedString)) {
				if (verbose) {
					print(prefix, CmdSyntaxKind[node.kind], `'${node.rawText}'`, `[${node.pos}:${node.endPos}]`, "{");
				} else {
					print(prefix, CmdSyntaxKind[node.kind], "{");
				}

				this.prettyPrint(node.values, prefix + "\t", verbose);
				print(prefix, "}");
			} else if (isNode(node, CmdSyntaxKind.Source)) {
				if (verbose) {
					print(prefix, CmdSyntaxKind[node.kind], `[${node.pos}:${node.endPos}]`, "{");
				} else {
					print(prefix, CmdSyntaxKind[node.kind], "{");
				}

				this.prettyPrint(node.children, prefix + "\t", verbose);
				print(prefix, "}");
			} else if (isNode(node, CmdSyntaxKind.PrefixToken)) {
				print(prefix, CmdSyntaxKind[node.kind], node.value);
			} else if (isNode(node, CmdSyntaxKind.PrefixExpression)) {
				print(prefix, CmdSyntaxKind[node.kind], "{");
				this.prettyPrint([node.prefix, node.expression], prefix + "\t", verbose);
				print(prefix, "}");
			} else if (isNode(node, CmdSyntaxKind.VariableDeclaration)) {
				print(prefix, CmdSyntaxKind[node.kind], "{");
				this.prettyPrint([node.identifier, node.expression], prefix + "\t", verbose);
				print(prefix, "}");
			} else if (isNode(node, CmdSyntaxKind.VariableStatement)) {
				print(prefix, CmdSyntaxKind[node.kind], "{");
				this.prettyPrint([node.declaration], prefix + "\t", verbose);
				print(prefix, "}");
			} else if (isNode(node, CmdSyntaxKind.EndOfStatement)) {
				print(prefix, "EndOfStatement");
			} else if (isNode(node, CmdSyntaxKind.Invalid)) {
				print(prefix, "SYNTAX ERROR", node.message);
			}
		}
	}

	/**
	 * Will take the node and render it
	 *
	 * (Testing the AST)
	 * @internal
	 */
	public static render(node: Node, formatString = true): string {
		if (node === undefined) {
			return "<error>";
		}

		if (isNode(node, CmdSyntaxKind.CommandStatement)) {
			return node.children.map((c) => this.render(c)).join(" ");
		} else if (isNode(node, CmdSyntaxKind.CommandName)) {
			return node.name.text;
		} else if (isNode(node, CmdSyntaxKind.String)) {
			return node.quotes !== undefined && formatString
				? `${node.quotes}${node.text.gsub(node.quotes, `\\${node.quotes}`)[0]}${node.quotes}`
				: node.text;
		} else if (isNode(node, CmdSyntaxKind.Number)) {
			return tostring(node.value);
		} else if (isNode(node, CmdSyntaxKind.Option)) {
			return node.flag.size() > 1 ? `--${node.flag}` : `-${node.flag}`;
		} else if (isNode(node, CmdSyntaxKind.BinaryExpression)) {
			return this.render(node.left) + " " + this.render(node.operator) + " " + this.render(node.right);
		} else if (isNode(node, CmdSyntaxKind.Identifier)) {
			return `$${node.name}`;
		} else if (isNode(node, CmdSyntaxKind.InterpolatedString)) {
			return `"${node.values.map((v) => this.render(v, false)).join(" ")}"`;
		} else if (isNode(node, CmdSyntaxKind.Source)) {
			return node.children.map((c) => this.render(c)).join("\n");
		} else if (isNode(node, CmdSyntaxKind.EndOfStatement)) {
			return "";
		} else if (isNode(node, CmdSyntaxKind.VariableStatement)) {
			return this.render(node.declaration);
		} else if (isNode(node, CmdSyntaxKind.VariableDeclaration)) {
			return this.render(node.identifier) + " = " + this.render(node.expression);
		} else if (isNode(node, CmdSyntaxKind.PrefixExpression)) {
			return this.render(node.prefix) + this.render(node.expression);
		} else if (isNode(node, CmdSyntaxKind.PrefixToken)) {
			return node.value;
		} else if (isNode(node, CmdSyntaxKind.OperatorToken)) {
			return node.operator;
		} else if (isNode(node, CmdSyntaxKind.Boolean)) {
			return tostring(node.value);
		} else if (isNode(node, CmdSyntaxKind.Invalid)) {
			return "";
		} else if (isNode(node, CmdSyntaxKind.InnerExpression)) {
			return "$(" + this.render(node.expression) + ")";
		} else {
			// eslint-disable-next-line roblox-ts/lua-truthiness
			throw `Cannot Render SyntaxKind ${getNodeKindName(node)}`;
		}
	}
}
