import {
	Option,
	CommandStatement,
	isNode,
	CmdSyntaxKind,
	getKindName,
	createBooleanNode,
	isNodeIn,
	Node,
	NodeKind,
	NodeTypes,
	flattenInterpolatedString,
	getNodeKindName,
	CommandSource,
	BinaryExpression,
	CommandName,
} from "./Nodes";

type ValidationType = "string" | "number" | "boolean";
export interface CommandOption {
	name: string;
	alias?: string[];
	type: ValidationType | "switch" | "any" | "var";
}

export const enum ResultKind {
	Command,
	SequentialCommands,
}

export interface CommandResult {
	kind: ResultKind.Command;
	command: string;
	options: Map<string, defined>;
	args: Array<defined>;
}

export interface CommandSequenceResult {
	kind: ResultKind.SequentialCommands;
	left: CommandResult;
	right: CommandResult;
}

interface InterpreterOptions {
	throwOnInvalidOption: boolean;
}

export interface CommandDeclaration {
	command: string;
	options: CommandOption[];
	args: ValidationType[];
}

/**
 * Used to interpret given command statements, will throw on invalid options & args
 *
 */
export default class CommandAstInterpreter {
	public static isCommand(result: CommandSequenceResult | CommandResult): result is CommandResult {
		return result.kind === ResultKind.Command;
	}

	public static isCommandSeqence(result: CommandSequenceResult | CommandResult): result is CommandSequenceResult {
		return result.kind === ResultKind.SequentialCommands;
	}

	constructor(private commands: CommandDeclaration[]) {}

	private expectOptionTypes<K extends NodeKind>(
		command: CommandName,
		option: Option,
		node: Node,
		...kind: K[]
	): asserts node is NodeTypes[K] {
		if (!isNodeIn(node, kind)) {
			error(
				`[CommandInterpreter] Invalid option for ${command.name.text}: ${option.flag} expects ${kind
					.map((k) => getKindName(k))
					.join(" | ")}, got ${getNodeKindName(node)}.`,
			);
		}
	}

	private expectOptionType<K extends NodeKind>(
		command: CommandName,
		option: Option,
		node: Node,
		kind: K,
	): asserts node is NodeTypes[K] {
		if (!isNode(node, kind)) {
			error(
				`[CommandInterpreter] Invalid option for ${command.name.text}: ${option.flag} expects ${getKindName(
					kind,
				)}, got ${getNodeKindName(node)}.`,
			);
		}
	}

	public interpret(
		node: CommandStatement | CommandSource | BinaryExpression,
		variables: Record<string, defined> = { _VERSION: PKG_VERSION },
		interpreterOptions: InterpreterOptions = { throwOnInvalidOption: true },
		results = new Array<CommandResult | CommandSequenceResult>(),
	) {
		if (isNode(node, CmdSyntaxKind.CommandStatement)) {
			results.push(this.interpretCommandStatement(node, variables, interpreterOptions));
		} else if (isNode(node, CmdSyntaxKind.BinaryExpression)) {
			throw `[CommandInterpreter] Not yet supported!`;
			// results.push({
			// 	kind: ResultKind.SequentialCommands,
			// 	left: this.interpret(node.left),
			// });
		} else if (isNode(node, CmdSyntaxKind.Source)) {
			for (const statement of node.children) {
				if (
					isNode(statement, CmdSyntaxKind.CommandStatement) ||
					isNode(statement, CmdSyntaxKind.BinaryExpression)
				) {
					this.interpret(statement, variables, interpreterOptions, results);
				} else {
					throw `[CommandInterpreter] Cannot intepret ${getNodeKindName(node)}`;
				}
			}
		}
		return results;
	}

	/**
	 * Try interpreting the given statement
	 *
	 * @throws If there are invalid parts to the command - such as invalid options or arguments
	 *
	 * @param statementNode The statement node
	 * @param variables The variables to pass to the interpreter
	 * @param interpreterOptions The interpreter options
	 */
	public interpretCommandStatement(
		statementNode: CommandStatement,
		variables: Record<string, defined> = { _VERSION: PKG_VERSION },
		interpreterOptions: InterpreterOptions = { throwOnInvalidOption: true },
	) {
		const parsedResult: CommandResult = {
			kind: ResultKind.Command,
			command: "",
			options: new Map(),
			args: [],
		};
		const { options, args } = parsedResult;

		assert(
			statementNode.kind === CmdSyntaxKind.CommandStatement,
			"[CommandInterpreter] Invalid node: " +
				getNodeKindName(statementNode) +
				", expects: " +
				getKindName(CmdSyntaxKind.CommandStatement),
		);
		const command = statementNode.command;
		parsedResult.command = command.name.text;

		const matchingCommand = this.commands.find((c) => c.command === command.name.text);
		if (!matchingCommand) {
			throw `[CommandInterpreter] Command ${command.name.text} is not declared`;
		}

		const commandTypeHandler: Record<
			CommandOption["type"],
			(optionFullName: string, optionNode: Option, nextNode: Node) => boolean
		> = {
			string: (optionFullName, node, nextNode) => {
				if (isNode(nextNode, CmdSyntaxKind.InterpolatedString)) {
					nextNode = flattenInterpolatedString(nextNode, variables);
				}
				this.expectOptionTypes(command, node, nextNode, CmdSyntaxKind.String);
				options.set(optionFullName, nextNode.text);
				return true;
			},
			number: (optionFullName, node, nextNode) => {
				this.expectOptionType(command, node, nextNode, CmdSyntaxKind.Number);
				options.set(optionFullName, nextNode.value);
				return true;
			},
			boolean: (optionFullName, node, nextNode) => {
				this.expectOptionType(command, node, nextNode, CmdSyntaxKind.Boolean);
				options.set(optionFullName, nextNode.value);
				return true;
			},
			any: (optionFullName, _, nextNode) => {
				if (isNode(nextNode, CmdSyntaxKind.String)) {
					options.set(optionFullName, nextNode.text);
				} else if (isNode(nextNode, CmdSyntaxKind.InterpolatedString)) {
					options.set(optionFullName, flattenInterpolatedString(nextNode, variables).text);
				} else if (isNode(nextNode, CmdSyntaxKind.Number)) {
					options.set(optionFullName, nextNode.value);
				} else if (isNode(nextNode, CmdSyntaxKind.Boolean)) {
					options.set(optionFullName, nextNode.value);
				} else {
					throw `[CommandInterpreter] Cannot parse node value ${getNodeKindName(nextNode)}`;
				}
				return true;
			},
			var: (optionFullName, node, nextNode) => {
				this.expectOptionType(command, node, nextNode, CmdSyntaxKind.Identifier);
				options.set(optionFullName, variables[nextNode.name]);
				return true;
			},
			switch: (node, _) => {
				options.set(node, createBooleanNode(true));
				return false;
			},
		};

		let ptr = 0;
		let argIdx = 0;
		const children = statementNode.children;
		while (ptr < children.size()) {
			const node = children[ptr];

			if (isNode(node, CmdSyntaxKind.Option)) {
				// handle option
				const option = matchingCommand.options.find(
					(f) => f.name === node.flag || f.alias?.includes(node.flag),
				);

				if (option === undefined) {
					if (interpreterOptions.throwOnInvalidOption) {
						throw `[CommandInterpreter] Invalid option for ${matchingCommand.command}: ${node.flag}`;
					} else {
						commandTypeHandler.switch(node.flag, node, children[ptr + 1]);
					}
				} else {
					const typeHandler = commandTypeHandler[option.type];
					if (typeHandler) {
						const nextNode = children[ptr + 1];
						typeHandler(option.name, node, nextNode) && ptr++;
					} else {
						throw `[CommandInterpreter] Cannot handle option type: ${option.type}`;
					}
				}
			} else {
				// Handle arguments
				if (!isNodeIn(node, [CmdSyntaxKind.CommandName, CmdSyntaxKind.EndOfStatement])) {
					if (matchingCommand.args.size() === 0) {
						// Allow any number of arguments if not specified
						continue;
					}

					if (argIdx >= matchingCommand.args.size()) {
						throw `[CommandInterpreter] Exceeding argument list: [ ${matchingCommand.args.join(", ")} ]`;
					}

					const arg = matchingCommand.args[argIdx];
					if (arg === "string") {
						if (!isNode(node, CmdSyntaxKind.String) && !isNode(node, CmdSyntaxKind.InterpolatedString)) {
							throw `[CommandInterpreter] Invalid argument, expected String got ${getNodeKindName(node)}`;
						}
					} else if (arg === "boolean") {
						if (!isNode(node, CmdSyntaxKind.Boolean)) {
							throw `[CommandInterpreter] Invalid argument, expected Boolean got ${getNodeKindName(
								node,
							)}`;
						}
					} else if (arg === "number") {
						if (!isNode(node, CmdSyntaxKind.Number)) {
							throw `[CommandInterpreter] Invalid argument, expected Number got ${getNodeKindName(node)}`;
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
