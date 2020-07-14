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
} from "./Nodes";

type ValidationType = "string" | "number" | "boolean";
export interface CommandOption {
	name: string;
	alias?: string[];
	type: ValidationType | "switch";
}

export interface ParsedNodeResult {
	options: Map<Option, StringLiteral | InterpolatedStringExpression | NumberLiteral | BooleanLiteral>;
	args: Array<StringLiteral | InterpolatedStringExpression | NumberLiteral | BooleanLiteral>;
}

/**
 * Used to interpret given command statements, will throw on invalid options & args
 *
 */
export default class CommandAstInterpreter {
	constructor(private command: string, private options: CommandOption[], private args: ValidationType[]) {}

	/**
	 * Try interpreting the given statement
	 *
	 * @throws If there are invalid parts to the command - such as invalid options or arguments
	 */
	public interpret(statementNode: CommandStatement) {
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
					throw `[CommandInterpreter] Invalid option for ${this.command}: ${node.flag}`;
				} else {
					if (option.type === "number") {
						const nextNode = children[ptr + 1];
						if (!isNode(nextNode, CmdSyntaxKind.Number)) {
							throw `[CommandInterpreter] Invalid option for ${this.command}: ${
								node.flag
							} expects Number, got ${getKindName(nextNode?.kind)}.`;
						}
						options.set(node, nextNode);
						ptr++;
					} else if (option.type === "string") {
						const nextNode = children[ptr + 1];
						if (
							!isNode(nextNode, CmdSyntaxKind.String) &&
							!isNode(nextNode, CmdSyntaxKind.InterpolatedString)
						) {
							throw `[CommandInterpreter] Invalid option for ${this.command}: ${
								node.flag
							} expects String, got ${getKindName(nextNode?.kind)}.`;
						}
						options.set(node, nextNode);
						ptr++;
					} else if (option.type === "boolean") {
						const nextNode = children[ptr + 1];
						if (!isNode(nextNode, CmdSyntaxKind.Boolean)) {
							throw `[CommandInterpreter] Invalid option for ${this.command}: ${
								node.flag
							} expects Boolean, got ${getKindName(nextNode?.kind)}.`;
						}
						options.set(node, nextNode);
						ptr++;
					} else if (option.type === "switch") {
						// Switch is basically just 'true' here.
						options.set(node, createBooleanNode(true));
					} else {
						throw `[CommandInterpreter] Cannot handle type: ${option.type}`;
					}
				}
			} else {
				// Handle arguments
				if (!isNodeIn(node, [CmdSyntaxKind.CommandName, CmdSyntaxKind.EndOfStatement])) {
					if (argIdx > this.args.size()) {
						throw `[CommandInterpreter] Exceeding maximum arguments`;
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
				} else {
					print("ignore", getKindName(node.kind));
				}
			}

			ptr++;
		}
		return parsedResult;
	}
}
