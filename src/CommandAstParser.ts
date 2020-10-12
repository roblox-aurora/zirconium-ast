/* eslint-disable roblox-ts/lua-truthiness */
import type { ValidationResult } from "./Validation";
import { Node, InterpolatedStringExpression, StringLiteral, CommandSource, NodeError } from "./Nodes/NodeTypes";
import {
	createNumberNode,
	createBooleanNode,
	createStringNode,
	createEndOfStatementNode,
	createCommandName,
	createPrefixExpression,
	createCommandStatement,
	createBinaryExpression,
	createVariableStatement,
	createVariableDeclaration,
	createInvalidNode,
	createInterpolatedString,
	createIdentifier,
	createOptionKey,
	createInnerExpression,
	createOperator,
	createPrefixToken,
	createCommandSource,
	createNodeError,
	createOptionExpression,
	createIfStatement,
} from "./Nodes/Create";
import { isNode, isValidPrefixCharacter, isPrefixableExpression, isAssignableExpression } from "./Nodes/Guards";
import * as guard from "./Nodes/Guards";
import { CmdSyntaxKind, NodeFlag } from "./Nodes";
import { getNodeKindName, offsetNodePosition, getFriendlyName } from "./Nodes/Functions";
import { AstCommandDefinitions, AstCommandDefinition, nodeMatchesAstDefinitionTypes } from "./Definitions/Definitions";

const enum OperatorLiteralToken {
	AndAsync = "&",
	And = "&&",
	Pipe = "|",
}

const Keyword = {
	If: "if",
} as const;

const KEYWORDS: string[] = [Keyword.If];

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

export interface ParserOptions {
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

	commands: AstCommandDefinitions;

	/** Whether or not to enable strict mode */
	strictCommands: boolean;
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
	strictCommands: true,
	maxNestedInnerExpressions: 1,
	commands: [],
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
	private source = "";
	private escaped = false;
	public readonly errors = new Array<string>();
	private options: ParserOptions;
	private commands: AstCommandDefinitions;

	constructor(options?: Partial<ParserOptions>) {
		this.options = { ...DEFAULT_PARSER_OPTIONS, ...options };
		this.commands = this.options.commands;
	}

	private validateCommandDefinitions() {
		for (const command of this.commands) {
			assert(typeIs(command.command, "string"));
			if (command.args !== undefined) {
				for (const [i, arg] of command.args.entries()) {
					assert(typeIs(arg.type, "table"), "prop 'type' should be of type table");
					assert(
						arg.variadic === undefined || typeIs(arg.variadic, "boolean"),
						"prop 'varadic' should be a boolean",
					);
					assert(
						arg.variadic === undefined || i === command.args.size() - 1,
						"prop 'varadic' should only be on last argument",
					);
				}
			}
		}
	}

	private next(offset = 0) {
		return this.source.sub(this.ptr + offset, this.ptr + offset);
	}

	private nextMatch(value: string, offset = 0) {
		return this.source.sub(this.ptr + offset, this.ptr + offset + value.size() - 1) === value;
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
				node.startPos = this.ptr - this.tokens.size() - 1;
				node.endPos = this.ptr - 1;
				node.rawText = this.tokens;
			} else if (this.tokens === "true" || this.tokens === "false") {
				node = createBooleanNode(this.tokens === "true");
				node.startPos = this.ptr - this.tokens.size() - 1;
				node.endPos = this.ptr - 1;
				node.rawText = this.tokens;
			} else if (KEYWORDS.includes(this.tokens)) {
				// create empty if statement
				if (this.tokens === Keyword.If) {
					node = createIfStatement(undefined, undefined, undefined);
					node.startPos = this.ptr - this.tokens.size() - 1;
					node.endPos = this.ptr - 1;
					node.rawText = this.tokens;
				} else {
					throw `Unhandled expression: ${this.tokens}`;
				}
			} else {
				node = createStringNode(this.tokens, options?.quotes);
				node.isUnterminated = options?.isUnterminated;

				if (options?.startPos !== undefined) {
					node.startPos = options.startPos;
				} else {
					node.startPos = this.ptr - this.tokens.size();
				}

				if (options?.endPos !== undefined) {
					node.endPos = options.endPos;
				} else {
					node.endPos = this.ptr - 1;
				}

				node.rawText = this.source.sub(node.startPos, node.endPos);
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
	 *
	 * `cmd subcommand [--options ...] [arg1 arg2 ...]` (if using commands option)
	 * ### VariableDeclarationStatement
	 * `$var = [expression]`
	 */
	private appendStatementNode(startPos = 0, endPos = 0) {
		this.pushChildNode(this.createNodeFromTokens());

		// If we have child nodes, we'll work with what we have...
		if (this.childNodes.size() > 0) {
			const firstNode = this.getNodeAt(0, this.childNodes);

			if (guard.isNode(firstNode, CmdSyntaxKind.IfStatement)) {
				const nextNode = this.getNodeAt(1, this.childNodes);
				if (isNode(nextNode, CmdSyntaxKind.Block) || isNode(nextNode, CmdSyntaxKind.VariableStatement)) {
					firstNode.thenStatement = nextNode;
					this.popChildNode(1);
				} else {
					this.childNodes.push(createInvalidNode(`This is not a valid expression`, nextNode));
				}
			}

			if (guard.isStringLiteral(firstNode) && firstNode.quotes === undefined) {
				this.childNodes.push(createEndOfStatementNode());

				const nameNodes = new Array<Node>();

				const nameNode = createCommandName(firstNode);
				this.childNodes[0] = nameNode;
				nameNodes.push(nameNode);

				if (this.commands.size() > 0) {
					let matchingCommand = this.commands.find((c) => c.command === firstNode.text);

					if (matchingCommand) {
						let i = 1;

						if (matchingCommand.children !== undefined) {
							// Pull the subcommands out, yo!

							while (i < this.childNodes.size()) {
								const node = this.childNodes[i];
								if (
									matchingCommand &&
									matchingCommand.children !== undefined &&
									guard.isStringLiteral(node)
								) {
									const mc: AstCommandDefinition | undefined = matchingCommand.children.find(
										(c) => c.command === node.text,
									);

									if (mc) {
										matchingCommand = mc;
										const nameNode = createCommandName(node);
										this.childNodes[i] = nameNode;
										nameNodes.push(nameNode);
									}
								} else {
									break;
								}
								i++;
							}
						}

						const childNodes = new Array<Node>();
						const { options, args } = matchingCommand;

						if (options) {
							// Now we handle option "merging"
							i = 0;
							while (i < this.childNodes.size()) {
								const node = this.childNodes[i];
								if (guard.isOptionKey(node)) {
									const nextNode = this.childNodes[i + 1];
									const option = options[node.flag];
									if (option !== undefined) {
										const { type } = option;

										const matcher = nodeMatchesAstDefinitionTypes(nextNode, type);
										if (matcher.matches) {
											if (matcher.matchType === "switch") {
												childNodes.push(createOptionExpression(node, createBooleanNode(true)));
												i += 1;
												continue;
											} else {
												if (guard.isPrimitiveExpression(nextNode)) {
													childNodes.push(createOptionExpression(node, nextNode));
												} else {
													childNodes.push(createInvalidNode(`IsNotPrimitive`, node));
												}
											}
										} else {
											childNodes.push(
												createInvalidNode(
													`\`${matchingCommand.command}\` option '${
														node.flag
													}': type '${getFriendlyName(
														nextNode,
													)}' not assignable to type '${type.join(" | ")}'`,
													node,
												),
											);
											break;
										}
									} else {
										childNodes.push(createInvalidNode(`Invalid option '${node.flag}'`, node));
										break;
									}

									i += 2;
								} else {
									childNodes.push(node);
									i += 1;
								}
							}

							this.childNodes = childNodes;
						}

						if (args) {
							i = 0;
							let a = 0;

							const lastArg = args[args.size() - 1];

							while (i < this.childNodes.size()) {
								const node = this.childNodes[i];
								if (guard.isAssignableExpression(node)) {
									const arg = a + 1 in args ? args[a] : lastArg.variadic ? lastArg : undefined;
									// If is argument
									if (arg) {
										const { type } = arg;
										const match = nodeMatchesAstDefinitionTypes(node, type);
										if (!match.matches) {
											this.childNodes.push(
												createInvalidNode(
													`\`${matchingCommand.command}\` argument#${
														a + 1
													} '${getFriendlyName(node)}' not assignable to type '${type.join(
														" | ",
													)}'`,
													node,
												),
											);
										}
										a++;
									} else {
										this.childNodes.push(
											createInvalidNode(
												`\`${matchingCommand.command}\` argument #${
													a + 1
												} of type '${getFriendlyName(node)}' (${
													a + 1
												} of ${args.size()}) exceeds arguments list : [ ${args
													.map((a) => a.type.join(" | "))
													.join(", ")} ] `,
												node,
											),
										);
										break;
									}
								}
								i++;
							}
						}
					} else if (this.options.strictCommands) {
						this.childNodes.push(createInvalidNode(`Invalid command '${firstNode.text}'`, firstNode));
					}
				} else {
					if (this.options.strictCommands) {
						this.childNodes.push(createInvalidNode(`Invalid command '${firstNode.text}'`, firstNode));
					} else {
						warn(
							"[CommandParser] No commands defined for AST, option nodes will not be properly accounted for.",
						);
					}
				}

				// Do final statement "combining" actions
				let i = 0;
				const childNodes = new Array<Node>();
				while (i < this.childNodes.size()) {
					const node = this.childNodes[i];
					if (guard.isPrefixToken(node)) {
						const nextNode = this.childNodes[i + 1];
						if (isPrefixableExpression(nextNode)) {
							childNodes.push(createPrefixExpression(node, nextNode));
						} else {
							if (nextNode === undefined) {
								childNodes.push(createInvalidNode(`Unexpected trailing PrefixToken`, node));
							}

							childNodes.push(
								createInvalidNode(`Unexpected ${getNodeKindName(nextNode)} after PrefixToken`, node),
							);
						}
						i += 2;
					} else {
						childNodes.push(node);
						i++;
					}
				}
				this.childNodes = childNodes;

				const lastNode = this.getNodeAt(-1);
				if (guard.isOperatorToken(lastNode)) {
					const prevNode = this.getNodeAt(-2);
					const nextNode = createCommandStatement(nameNode, this.childNodes, startPos, endPos);
					nextNode.rawText = this.source.sub(startPos, endPos);

					const expression = createBinaryExpression(prevNode, lastNode, nextNode, prevNode.startPos, endPos);
					// eslint-disable-next-line roblox-ts/lua-truthiness
					expression.rawText = this.source.sub(prevNode.startPos ?? 0, endPos);

					this.nodes = [...this.nodes.slice(0, this.nodes.size() - 2), expression];
				} else {
					const statement = createCommandStatement(nameNode, this.childNodes, startPos, endPos);
					statement.rawText = this.source.sub(startPos, endPos);
					this.nodes.push(statement);
				}
			} else if (guard.isIdentifier(firstNode) && this.options.variableDeclarations) {
				const nextNode = this.getNodeAt(1, this.childNodes);
				if (guard.isOperatorToken(nextNode) && nextNode.operator === "=") {
					const expressionNode = this.getNodeAt(2, this.childNodes);
					if (expressionNode) {
						if (isAssignableExpression(expressionNode)) {
							this.nodes.push(
								createVariableStatement(createVariableDeclaration(firstNode, expressionNode)),
							);
						} else {
							throw `[CommandParser] Unexpected assignment of ${getNodeKindName(
								expressionNode,
							)} to variable`;
						}
					} else {
						this.nodes.push(createInvalidNode(`Expression expected: '$${firstNode.name} ='`, nextNode));
					}
				} else {
					this.nodes.push(createInvalidNode(`Unexpected Identifier: ${firstNode.name}`, firstNode));
				}
			} else {
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

		while (this.ptr < this.source.size()) {
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

				const variable = this.parseVariable(true);
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
					interpolatedNode.startPos = start;
					interpolatedNode.endPos = this.ptr - 1;
					interpolatedNode.rawText = this.source.sub(start, this.ptr - 1);
					this.pushChildNode(interpolatedNode);
				} else {
					this.pushChildNode(this.createNodeFromTokens({ quotes, startPos: start, endPos: this.ptr - 1 }));
				}

				return true;
			}

			this.escaped = false;
			this.tokens += this.pop();
		}

		this.errors.push(`Unterminated StringLiteral:  ${this.source.sub(start, this.ptr)}`);
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
		while (this.ptr < this.source.size()) {
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
	private parseVariable(isInterpolated = false) {
		const start = this.ptr - 1;
		while (this.ptr < this.source.size()) {
			const char = this.next();
			if (
				char === TOKEN.SPACE ||
				char === "=" ||
				char === "\n" ||
				(isInterpolated && char.match("[^A-Za-z0-9_]")[0])
			) {
				const identifier = createIdentifier(this.tokens);
				identifier.startPos = start;
				identifier.endPos = start + this.tokens.size();
				identifier.rawText = this.source.sub(start, start + this.tokens.size());
				this.tokens = "";
				return identifier;
			}

			this.tokens += this.pop();
		}

		const identifier = createIdentifier(this.tokens);
		identifier.startPos = start;
		identifier.endPos = start + this.tokens.size();
		identifier.rawText = this.source.sub(start, start + this.tokens.size());
		this.tokens = "";
		return identifier;
		//}
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
		while (this.ptr < this.source.size()) {
			const char = this.next();
			const valid = char.match("[%a%d_-]")[0];
			if (char === TOKEN.SPACE || valid === undefined) {
				if (this.tokens !== "") {
					if (this.options.kebabArgumentsToCamelCase) {
						this.tokens = this.kebabCaseToCamelCase(this.tokens);
					}

					this.childNodes.push(createOptionKey(this.tokens, this.ptr - 1));
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

			this.childNodes.push(createOptionKey(this.tokens, this.ptr - 1));
			this.tokens = "";
		}
	}

	/**
	 * Parse short-form option names
	 */
	private parseOptionLetter() {
		while (this.ptr < this.source.size()) {
			const char = this.next();
			if (char === TOKEN.SPACE || char.match("[%a_]")[0] === undefined) {
				break;
			}

			this.childNodes.push(createOptionKey(this.pop()));
		}
	}

	public parseNestedCommand(escapeChar: string = TOKEN.BACKQUOTE) {
		let cmd = "";
		let nestLevel = 0;
		const start = this.ptr;
		while (this.ptr < this.source.size()) {
			const char = this.next();

			if (char === escapeChar) {
				if (nestLevel === 0) {
					this.pop();
					const subCommand = new CommandAstParser(this.options).Parse(cmd).children[0];
					if (!guard.isCommandStatement(subCommand)) {
						this.nodes.push(
							createInvalidNode(
								`Invalid inner expression: '${CommandAstParser.render(subCommand)}' (${getNodeKindName(
									subCommand,
								)}) - Only a CommandStatement is allowed.`,
								subCommand,
								start,
								start + cmd.size() - 1,
							),
						);
					} else {
						const inner = createInnerExpression(subCommand, start, start + cmd.size());
						inner.rawText = this.source.sub(start, start + cmd.size() - 1);
						offsetNodePosition(inner.expression, start);
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

	public SetCommandDefinitions(definitions: AstCommandDefinitions) {
		this.commands = definitions;
	}

	public GetSource() {
		return this.source;
	}

	/**
	 * Parses the command source provided to this CommandAstParser
	 */
	public Parse(rawSource: string): CommandSource {
		this.validateCommandDefinitions();

		let valid = true;
		let statementBegin = 0;
		this.source = rawSource;
		this.ptr = 0;
		this.nodes = [];

		while (this.ptr < this.source.size()) {
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
					subCommand && this.pushChildNode(subCommand);
					continue;
				}

				const id = this.parseVariable();
				id && this.pushChildNode(id);
				continue;
			} else if (this.nextMatch(OperatorLiteralToken.And) && this.options.operators) {
				this.pop(2);
				this.appendStatementNode(statementBegin, this.ptr - 1);
				statementBegin = this.ptr + 1;
				this.nodes.push(createOperator(OperatorLiteralToken.And));
				continue;
			} else if (this.nextMatch(OperatorLiteralToken.Pipe) && this.options.operators) {
				this.pop();
				this.appendStatementNode(statementBegin, this.ptr - 1);
				statementBegin = this.ptr + 1;
				this.nodes.push(createOperator(OperatorLiteralToken.Pipe));
				continue;
			} else if (char === "=") {
				this.pop();
				this.pushChildNode(createOperator("=", this.ptr - 1));
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

		const source = createCommandSource(this.nodes);
		source.startPos = 0;
		source.endPos = this.ptr - 1;
		source.rawText = this.source;
		return source;
	}

	public static validate(node: Node, errorNodes = new Array<NodeError>()): ValidationResult {
		if (guard.isSource(node)) {
			for (const child of node.children) {
				if (guard.isValidExpression(child)) {
					this.validate(child, errorNodes);
				} else if (guard.isNode(child, CmdSyntaxKind.Invalid)) {
					this.validate(child, errorNodes);
				} else {
					errorNodes.push(createNodeError(`'${this.render(child)}' is not a valid expression`, child));
				}
			}
		} else if (guard.isCommandStatement(node)) {
			for (const child of node.children) {
				this.validate(child, errorNodes);
			}
		} else if (guard.isBinaryExpression(node)) {
			this.validate(node.left, errorNodes);
			this.validate(node.right, errorNodes);
		} else if (guard.isVariableStatement(node)) {
			const {
				declaration: { expression, identifier },
			} = node;
			this.validate(identifier, errorNodes);
			this.validate(expression, errorNodes);
		} else if (guard.isStringLiteral(node)) {
			if ((node.flags & NodeFlag.NodeHasError) !== 0) {
				if (node.isUnterminated) {
					errorNodes.push(
						createNodeError(
							`Unterminated string: ${node.quotes ?? ""}${node.text} [${node.startPos ?? 0}:${
								node.endPos ?? 0
							}]`,
							node,
						),
					);
				}
			}
		} else if (guard.isIdentifier(node)) {
			if (!node.name.match(guard.VALID_VARIABLE_NAME)[0]) {
				if (node.name.match("^%d")[0]) {
					errorNodes.push(
						createNodeError(
							`Invalid variable name '${node.name}' - variable must start with a letter or an underscore`,
							node,
						),
					);
				} else {
					const invalidChars = node.name.match("[^A-z0-9_]")[0];
					errorNodes.push(
						createNodeError(
							`Invalid variable name '${node.name}' - contains invalid character '${invalidChars}'`,
							node,
						),
					);
				}
			}
		} else if (guard.isNode(node, CmdSyntaxKind.CommandName)) {
			const { text } = node.name;
			if (!text.match(guard.VALID_COMMAND_NAME)[0]) {
				errorNodes.push(createNodeError(`Invalid command name '${text}'`, node.name));
			}
		} else if (guard.isInvalid(node)) {
			errorNodes.push(createNodeError(node.message, node));
		} else if ((node.flags & NodeFlag.NodeHasError) !== 0) {
			errorNodes.push(createNodeError(`Node Error ${getNodeKindName(node)}`, node));
		}
		if (errorNodes.size() > 0) {
			return { success: false, errorNodes };
		}

		return { success: true };
	}

	public static assert(node: Node, source?: string) {
		const result = this.validate(node);
		if (!result.success) {
			const firstNode = result.errorNodes[0];

			if (source) {
				throw `[CmdParser] '${source.sub(firstNode.node.startPos ?? 0, firstNode.node.endPos)}' - ${
					firstNode.message
				}`;
			} else {
				throw `[CmdParser] [${firstNode.node.startPos ?? 0}:${firstNode.node.endPos ?? 0}] ${
					firstNode.message
				}`;
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
			return node.children
				.map((c) => this.render(c))
				.filter((c) => c !== "")
				.join(" ");
		} else if (isNode(node, CmdSyntaxKind.CommandName)) {
			return node.name.text;
		} else if (isNode(node, CmdSyntaxKind.String)) {
			return node.quotes !== undefined && formatString
				? `${node.quotes}${node.text.gsub(node.quotes, `\\${node.quotes}`)[0]}${node.quotes}`
				: node.text;
		} else if (isNode(node, CmdSyntaxKind.Number)) {
			return tostring(node.value);
		} else if (isNode(node, CmdSyntaxKind.OptionKey)) {
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
			return this.render(node.expression);
		} else if (isNode(node, CmdSyntaxKind.InnerExpression)) {
			return "$(" + this.render(node.expression) + ")";
		} else if (isNode(node, CmdSyntaxKind.OptionExpression)) {
			return this.render(node.option) + " " + this.render(node.expression);
		} else if (isNode(node, CmdSyntaxKind.IfStatement)) {
			if (node.condition) {
				if (node.thenStatement && node.elseStatement) {
					return `if (${node.condition}) ${this.render(node.thenStatement)} else ${this.render(
						node.elseStatement,
					)}`;
				} else if (node.thenStatement) {
					return `if (${node.condition}) ${this.render(node.thenStatement)}`;
				} else {
					return `if (${node.condition})`;
				}
			} else {
				return "if";
			}
		} else {
			// eslint-disable-next-line roblox-ts/lua-truthiness
			throw `Cannot Render SyntaxKind ${getNodeKindName(node)}`;
		}
	}
}
