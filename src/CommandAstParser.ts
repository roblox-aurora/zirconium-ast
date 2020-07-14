import {
	Node,
	CmdSyntaxKind,
	getSiblingNode,
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
} from "./Nodes";

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
	BACKSLASH = "\\",
}

interface ParserOptions {
	variables: boolean;
	options: boolean;
	operators: boolean;
	interpolatedStrings: boolean;
}

const DEFAULT_PARSER_OPTIONS: ParserOptions = {
	variables: true,
	options: true,
	operators: true,
	interpolatedStrings: true,
};

interface NodeCreationOptions {
	quotes?: string;
}

export default class CommandAstParser {
	private ptr = 0;
	private childNodes = new Array<Node>();
	private nodes = new Array<Node>();
	private hasCommandName = false;
	private tokens = "";
	private raw: string;
	private escaped = false;
	private options: ParserOptions;

	constructor(raw: string, options?: ParserOptions) {
		this.raw = raw.trim();
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

	private createNodeFromTokens(options?: NodeCreationOptions) {
		let node: Node | undefined;
		// ensure non-empty, should skip whitespace
		if (this.tokens !== "") {
			if (!this.hasCommandName) {
				node = createCommandName(this.tokens);
				this.hasCommandName = true;
			} else {
				if (this.tokens.match("^%d+$")[0] !== undefined) {
					node = createNumberNode(tonumber(this.tokens)!);
				} else if (this.tokens === "true" || this.tokens === "false") {
					node = createBooleanNode(this.tokens === "true");
				} else {
					node = createStringNode(this.tokens.trim(), options?.quotes);
				}
			}
			this.tokens = "";
		}
		return node;
	}

	private getNodeAt(offset = 0) {
		if (offset < 0) {
			return this.nodes[this.nodes.size() + offset];
		} else {
			return this.nodes[offset];
		}
	}

	private createCommand() {
		this.pushChildNode(this.createNodeFromTokens());

		// If we have child nodes, we'll work with what we have...
		if (this.childNodes.size() > 0) {
			this.childNodes.push(createEndOfStatementNode());

			const nameNode = getSiblingNode(this.childNodes, CmdSyntaxKind.CommandName);
			if (nameNode) {
				const lastNode = this.getNodeAt(-1);
				if (isNode(lastNode, CmdSyntaxKind.Operator)) {
					const prevNode = this.getNodeAt(-2);
					this.nodes = [
						...this.nodes.slice(0, this.nodes.size() - 2),
						createBinaryExpression(
							prevNode,
							lastNode.operator,
							createCommandStatement(nameNode, this.childNodes),
						),
					];
				} else {
					this.nodes.push(createCommandStatement(nameNode, this.childNodes));
				}
			} else {
				throw `Expected ${CmdSyntaxKind[CmdSyntaxKind.CommandName]}, got ${
					CmdSyntaxKind[this.getNodeAt(-1).kind]
				}`;
			}

			this.hasCommandName = false;
			this.childNodes = [];
		}
	}

	private consumeStringLiteral(quotes = TOKEN.DOUBLE_QUOTE) {
		let isInterpolated = false;
		const interpolated: InterpolatedStringExpression["values"] = [];

		const start = this.ptr - 1;

		while (this.ptr < this.raw.size()) {
			const char = this.next();

			if (char === TOKEN.VARIABLE && this.options.interpolatedStrings && this.options.variables) {
				this.pop();

				isInterpolated = true;
				const prev = this.createNodeFromTokens({ quotes });
				prev && interpolated.push(prev as StringLiteral);

				const variable = this.parseVariable();
				variable && interpolated.push(variable);
				continue;
			} else if (char === quotes) {
				this.pop();

				if (isInterpolated) {
					const ending = this.createNodeFromTokens({ quotes }) as StringLiteral;
					ending && interpolated.push(ending);

					this.pushChildNode(createInterpolatedString(...interpolated));
				} else {
					this.pushChildNode(this.createNodeFromTokens({ quotes }));
				}

				return;
			}

			this.tokens += this.pop();
		}

		throw `[CommandParser] Unterminated StringLiteral:  ${this.raw.sub(start, this.ptr)}`;
	}

	private parseComment() {
		while (this.ptr < this.raw.size()) {
			const char = this.next();
			if (char === "\n" || char === "\r") {
				break;
			}
			this.ptr++;
		}
	}

	private parseVariable() {
		while (this.ptr < this.raw.size()) {
			const char = this.next();
			if (char === TOKEN.SPACE || char.match("%a")[0] === undefined) {
				if (this.tokens !== "") {
					const identifier = createIdentifier(this.tokens);
					this.tokens = "";
					return identifier;
				} else {
					throw `Invalid Variable Name: ${this.tokens}`;
				}
			}

			if (char.match("%w")[0] !== undefined) {
				this.tokens += this.pop();
			} else {
				throw `Variable cannot contain character: ${this.pop()}`;
			}
		}

		// In case it's last in the index
		if (this.tokens !== "") {
			const identifier = createIdentifier(this.tokens);
			this.tokens = "";
			return identifier;
		}
	}

	private parseLongKey() {
		while (this.ptr < this.raw.size()) {
			const char = this.next();
			const valid = char.match("[%a%d_-]")[0];
			if (char === TOKEN.SPACE || valid === undefined) {
				if (this.tokens !== "") {
					this.childNodes.push(createOption(this.tokens));
					this.tokens = "";
				}
				break;
			}

			this.tokens += this.pop();
		}

		if (this.tokens !== "") {
			this.childNodes.push(createOption(this.tokens));
			this.tokens = "";
		}
	}

	private validateTree() {
		const lastNode = this.getNodeAt(-1);

		// Don't allow a trailing &
		if (isNode(lastNode, CmdSyntaxKind.Operator)) {
			throw `[CommandParser] Trailing ${lastNode.operator} is invalid`;
		}
	}

	private parseFlags() {
		while (this.ptr < this.raw.size()) {
			const char = this.next();
			if (char === TOKEN.SPACE || char.match("[%a_]")[0] === undefined) {
				break;
			}

			this.childNodes.push(createOption(this.pop()));
		}
	}

	public Parse(): CommandSource {
		while (this.ptr < this.raw.size()) {
			const char = this.next();
			if (char === TOKEN.END || char === "\n" || char === TOKEN.CARRIAGE_RETURN) {
				if (!this.escaped) {
					this.createCommand();
					this.escaped = false;
				}

				this.pop();
				continue;
			} else if (char === "\\") {
				this.escaped = true;
				this.pop();
				continue;
			} else if (char === TOKEN.SPACE) {
				this.pushChildNode(this.createNodeFromTokens());
				this.pop();
				continue;
			} else if (char === TOKEN.HASH) {
				this.parseComment();
				continue;
			} else if (this.options.variables && char === TOKEN.VARIABLE) {
				this.pop();
				const id = this.parseVariable();
				id && this.pushChildNode(id);
				continue;
			} else if (this.nextMatch(OperatorLiteralToken.And) && this.options.operators) {
				this.pop(2);
				this.createCommand();
				this.nodes.push(createOperator(OperatorLiteralToken.And));
				continue;
			} else if (this.nextMatch(OperatorLiteralToken.Pipe) && this.options.operators) {
				this.pop();
				this.createCommand();
				this.nodes.push(createOperator(OperatorLiteralToken.Pipe));
				continue;
			} else if (
				this.options.options &&
				char === TOKEN.DASH &&
				this.next(-1) === TOKEN.SPACE &&
				this.hasCommandName
			) {
				this.pop();
				if (this.next() === TOKEN.DASH) {
					this.pop();
					this.parseLongKey();
					continue;
				} else {
					this.parseFlags();
					continue;
				}
			} else if (char === TOKEN.DOUBLE_QUOTE || char === TOKEN.SINGLE_QUOTE) {
				this.escaped = false;
				this.pop();
				this.consumeStringLiteral(char);
				continue;
			}

			this.tokens += this.pop();
			this.escaped = false;
		}

		this.pushChildNode(this.createNodeFromTokens());
		this.createCommand();

		this.validateTree();
		return createCommandSource(this.nodes);
	}

	public static prettyPrint(nodes: Node[], prefix = "") {
		for (const node of nodes) {
			if (isNode(node, CmdSyntaxKind.CommandName)) {
				print(prefix, CmdSyntaxKind[node.kind], node.name.text);
			} else if (isNode(node, CmdSyntaxKind.String)) {
				print(
					prefix,
					CmdSyntaxKind[node.kind],
					node.quotes !== undefined ? `${node.quotes}${node.text}${node.quotes}` : node.text,
				);
			} else if (isNode(node, CmdSyntaxKind.CommandStatement)) {
				print(prefix, CmdSyntaxKind[node.kind], "{");
				print(prefix + "\t", ".parent", getKindName(node.parent?.kind));
				this.prettyPrint(node.children, prefix + "\t");
				print(prefix, "}");
			} else if (isNode(node, CmdSyntaxKind.Number)) {
				print(prefix, CmdSyntaxKind[node.kind], node.value);
			} else if (isNode(node, CmdSyntaxKind.Option)) {
				print(prefix, CmdSyntaxKind[node.kind], node.flag);
				this.prettyPrint([node.right!], prefix + "\t");
			} else if (isNode(node, CmdSyntaxKind.Identifier)) {
				print(prefix, CmdSyntaxKind[node.kind], node.name);
			} else if (isNode(node, CmdSyntaxKind.Operator)) {
				print(prefix, CmdSyntaxKind[node.kind], node.operator);
			} else if (isNode(node, CmdSyntaxKind.BinaryExpression)) {
				print(prefix, CmdSyntaxKind[node.kind], "{");
				print(prefix + "\t", ".operator", `"${node.op}"`);
				print(prefix + "\t", ".parent", getKindName(node.parent?.kind));
				this.prettyPrint([node.left, node.right], prefix + "\t");
				print(prefix, "}");
			} else if (isNode(node, CmdSyntaxKind.InterpolatedString)) {
				print(prefix, CmdSyntaxKind[node.kind], "{");
				print(prefix + "\t", ".parent", getKindName(node.parent?.kind));
				this.prettyPrint(node.values, prefix + "\t");
				print(prefix, "}");
			} else if (isNode(node, CmdSyntaxKind.Source)) {
				print(prefix, CmdSyntaxKind[node.kind], "{");
				this.prettyPrint(node.children, prefix + "\t");
				print(prefix, "}");
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
			return node.quotes !== undefined && formatString ? `${node.quotes}${node.text}${node.quotes}` : node.text;
		} else if (isNode(node, CmdSyntaxKind.Number)) {
			return tostring(node.value);
		} else if (isNode(node, CmdSyntaxKind.Option)) {
			return node.flag.size() > 1 ? `--${node.flag}` : `-${node.flag}`;
		} else if (isNode(node, CmdSyntaxKind.BinaryExpression)) {
			return this.render(node.left) + " " + node.op + " " + this.render(node.right);
		} else if (isNode(node, CmdSyntaxKind.Identifier)) {
			return `$${node.name}`;
		} else if (isNode(node, CmdSyntaxKind.InterpolatedString)) {
			return `"${node.values.map((v) => this.render(v, false)).join(" ")}"`;
		} else if (isNode(node, CmdSyntaxKind.Source)) {
			return node.children.map((c) => this.render(c)).join("\n");
		} else {
			// eslint-disable-next-line roblox-ts/lua-truthiness
			throw `Cannot Render SyntaxKind ${CmdSyntaxKind[node.kind] ?? "unknown"}`;
		}
	}
}
