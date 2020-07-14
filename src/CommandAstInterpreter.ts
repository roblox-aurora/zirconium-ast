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
} from "./Nodes";

type ValidationType = "string" | "number" | "boolean" | "switch";
export interface CommandOption {
	name: string;
	alias?: string[];
	type: ValidationType;
}

export interface ParsedResult {
	options: Map<Option, StringLiteral | InterpolatedStringExpression | NumberLiteral | BooleanLiteral>;
	args: Array<StringLiteral | InterpolatedStringExpression | NumberLiteral | BooleanLiteral>;
}

class CommandInterpreterResult {
	constructor(public readonly result: ParsedResult) {}
}

/**
 * Used to interpret given command statements, will throw on invalid options & args
 */
export default class CommandAstInterpreter {
	constructor(private command: string, private options: CommandOption[], private args: ValidationType[]) {}

	/**
	 * Try interpreting the given statement
	 *
	 * @throws If there are invalid parts to the command - such as invalid options or arguments
	 */
	public interpret(statementNode: CommandStatement) {
		const parsedResult: ParsedResult = {
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
					} else if (option.type === "boolean") {
						const nextNode = children[ptr + 1];
						if (!isNode(nextNode, CmdSyntaxKind.Boolean)) {
							throw `[CommandInterpreter] Invalid option for ${this.command}: ${
								node.flag
							} expects Boolean, got ${getKindName(nextNode?.kind)}.`;
						}
						options.set(node, nextNode);
					} else if (option.type === "switch") {
						//
						options.set(node, createBooleanNode(true));
					} else {
						throw `[CommandInterpreter] Cannot handle type: ${option.type}`;
					}
					ptr++;
				}
			} else {
			}

			ptr++;
		}
		return new CommandInterpreterResult(parsedResult);
	}
}
