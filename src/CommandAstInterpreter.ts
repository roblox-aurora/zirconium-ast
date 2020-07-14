import {
	Option,
	StringLiteral,
	InterpolatedStringExpression,
	NumberLiteral,
	CommandStatement,
	isNode,
	CmdSyntaxKind,
	getKindName,
	BooleanLiteral,
	createBooleanNode,
	isNodeIn,
	Node,
	NodeKind,
	NodeTypes,
	Identifier,
} from "./Nodes";

type ValidationType = "string" | "number" | "boolean";
export interface CommandOption {
	name: string;
	alias?: string[];
	type: ValidationType | "switch" | "any" | "var";
}

export interface ParsedNodeResult {
	options: Map<string, StringLiteral | InterpolatedStringExpression | NumberLiteral | BooleanLiteral | Identifier>;
	args: Array<StringLiteral | InterpolatedStringExpression | NumberLiteral | BooleanLiteral | Identifier>;
}

interface InterpreterOptions {
	throwOnInvalidOption: boolean;
}

/**
 * Used to interpret given command statements, will throw on invalid options & args
 *
 */
export default class CommandAstInterpreter {
	constructor(private command: string, private options: CommandOption[], private args: ValidationType[]) {}

	private expectOptionTypes<K extends NodeKind>(
		option: Option,
		node: Node,
		...kind: K[]
	): asserts node is NodeTypes[K] {
		if (!isNodeIn(node, kind)) {
			error(
				`[CommandInterpreter] Invalid option for ${this.command}: ${option.flag} expects ${kind
					.map((k) => getKindName(k))
					.join(" | ")}, got ${getKindName(node?.kind)}.`,
			);
		}
	}

	private expectOptionType<K extends NodeKind>(option: Option, node: Node, kind: K): asserts node is NodeTypes[K] {
		if (!isNode(node, kind)) {
			error(
				`[CommandInterpreter] Invalid option for ${this.command}: ${option.flag} expects ${getKindName(
					kind,
				)}, got ${getKindName(node?.kind)}.`,
			);
		}
	}

	private commandTypeHandler: Record<
		CommandOption["type"],
		(options: ParsedNodeResult["options"], optionFullName: string, optionNode: Option, nextNode: Node) => boolean
	> = {
		string: (options, optionFullName, node, nextNode) => {
			this.expectOptionTypes(node, nextNode, CmdSyntaxKind.String, CmdSyntaxKind.InterpolatedString);
			options.set(optionFullName, nextNode);
			return true;
		},
		number: (options, optionFullName, node, nextNode) => {
			this.expectOptionType(node, nextNode, CmdSyntaxKind.Number);
			options.set(optionFullName, nextNode);
			return true;
		},
		boolean: (options, optionFullName, node, nextNode) => {
			this.expectOptionType(node, nextNode, CmdSyntaxKind.Boolean);
			options.set(optionFullName, nextNode);
			return true;
		},
		any: (options, optionFullName, node, nextNode) => {
			this.expectOptionTypes(
				node,
				nextNode,
				CmdSyntaxKind.Boolean,
				CmdSyntaxKind.String,
				CmdSyntaxKind.Number,
				CmdSyntaxKind.InterpolatedString,
				CmdSyntaxKind.Identifier,
			);
			options.set(optionFullName, nextNode);
			return true;
		},
		var: (options, optionFullName, node, nextNode) => {
			this.expectOptionType(node, nextNode, CmdSyntaxKind.Identifier);
			options.set(optionFullName, nextNode);
			return true;
		},
		switch: (options, node, _) => {
			options.set(node, createBooleanNode(true));
			return false;
		},
	};

	/**
	 * Try interpreting the given statement
	 *
	 * @throws If there are invalid parts to the command - such as invalid options or arguments
	 */
	public interpret(
		statementNode: CommandStatement,
		interpreterOptions: InterpreterOptions = { throwOnInvalidOption: true },
	) {
		const parsedResult: ParsedNodeResult = {
			options: new Map(),
			args: [],
		};
		const { options, args } = parsedResult;

		const command = statementNode.command;
		assert(
			command.name.text === this.command,
			`Invalid command match: '` + this.command + `' to StringLiteral('` + command.name.text + `')`,
		);

		let ptr = 0;
		let argIdx = 0;
		const children = statementNode.children;
		while (ptr < children.size()) {
			const node = children[ptr];

			if (isNode(node, CmdSyntaxKind.Option)) {
				// handle option
				const option = this.options.find((f) => f.name === node.flag || f.alias?.includes(node.flag));

				if (option === undefined) {
					if (interpreterOptions.throwOnInvalidOption) {
						throw `[CommandInterpreter] Invalid option for ${this.command}: ${node.flag}`;
					} else {
						this.commandTypeHandler.switch(options, node.flag, node, children[ptr + 1]);
					}
				} else {
					const typeHandler = this.commandTypeHandler[option.type];
					if (typeHandler) {
						const nextNode = children[ptr + 1];
						typeHandler(options, option.name, node, nextNode) && ptr++;
					} else {
						throw `[CommandInterpreter] Cannot handle option type: ${option.type}`;
					}
				}
			} else {
				// Handle arguments
				if (!isNodeIn(node, [CmdSyntaxKind.CommandName, CmdSyntaxKind.EndOfStatement])) {
					if (this.args.size() === 0) {
						// Allow any number of arguments if not specified
						continue;
					}

					if (argIdx >= this.args.size()) {
						throw `[CommandInterpreter] Exceeding argument list: [ ${this.args.join(", ")} ]`;
					}

					const arg = this.args[argIdx];
					if (arg === "string") {
						if (!isNode(node, CmdSyntaxKind.String) && !isNode(node, CmdSyntaxKind.InterpolatedString)) {
							throw `[CommandInterpreter] Invalid argument, expected String got ${getKindName(
								node.kind,
							)}`;
						}
					} else if (arg === "boolean") {
						if (!isNode(node, CmdSyntaxKind.Boolean)) {
							throw `[CommandInterpreter] Invalid argument, expected Boolean got ${getKindName(
								node.kind,
							)}`;
						}
					} else if (arg === "number") {
						if (!isNode(node, CmdSyntaxKind.Number)) {
							throw `[CommandInterpreter] Invalid argument, expected Number got ${getKindName(
								node.kind,
							)}`;
						}
					} else {
						throw `[CommandInterpreter] Cannot handle type ${arg}`;
					}
					args.push(node);
					argIdx++;
				}
			}

			ptr++;
		}
		return parsedResult;
	}
}
