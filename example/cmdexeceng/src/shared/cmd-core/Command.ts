import CommandGroup from "./CommandGroup";
import { CommandInterpreterOption, CommandDeclaration } from "@rbxts/cmd-ast/CommandAstInterpreter";
import { CmdTypeDefinition, CmdPrimitiveType, CmdType, isCmdTypeDefinition } from "./CommandType";

type ArgType = "string" | "boolean" | "number" | CmdTypeDefinition<any>;

export interface Option {
	alias?: string[];
	type: CmdPrimitiveType | CmdType | CmdTypeDefinition<defined, defined>;
	default?: defined;
	required?: boolean;
}

export interface CommandInfo<K extends Record<string, Option>> {
	/**
	 * The name of the command
	 */
	command: string;

	/**
	 * The options for the command
	 *
	 * Options are things like:
	 * -k and --key
	 */
	options: K;

	/**
	 * Arguments for this command
	 */
	args: ArgType[];

	/**
	 * Allowed command groups
	 */
	groups: CommandGroup[];
}

type GetResultingType<T, U> = U extends { default: T } ? T : U extends { required: true } ? T : T | undefined;
type InferType<T> = T extends { type: CmdPrimitiveType.String }
	? GetResultingType<string, T>
	: T extends { type: CmdPrimitiveType.Number }
	? GetResultingType<number, T>
	: T extends { type: CmdPrimitiveType.Switch }
	? boolean
	: T extends { type: CmdPrimitiveType.Boolean }
	? GetResultingType<boolean, T>
	: T extends { type: CmdTypeDefinition<infer _, infer A> }
	? GetResultingType<A, T>
	: never;

export type Mapped<T> = { [P in keyof T]: InferType<T[P]> };

/**
 * A command
 */
export default abstract class Command<K extends Record<string, Option>> {
	public readonly command: CommandInfo<K>["command"];
	public readonly options: K;
	public readonly args: CommandInfo<K>["args"];
	public readonly groups: CommandInfo<K>["groups"];
	public test = 1;

	public constructor({ command, options, args, groups }: CommandInfo<K>) {
		this.command = command;
		this.options = options;
		this.args = args;
		this.groups = groups;
	}

	/**
	 * Get interpreter options as AstInterpreter format
	 * @internal
	 */
	public getInterpreterOptions(): CommandInterpreterOption[] {
		// nothing
		const options = new Array<CommandInterpreterOption>();
		for (const [name, option] of Object.entries(this.options)) {
			if (typeIs(option.type, "table")) {
				options.push({
					name,
					default: option.default,
					alias: option.alias,
					type: "string",
				});
			} else {
				options.push({
					name,
					alias: option.alias,
					default: option.default,
					type: option.type as "string",
				});
			}
		}
		return options;
	}

	/**
	 * @internal
	 * I know this is gorey. I'm sorry. I'm not proud of this.
	 */
	public executeForPlayer(mappedOptions: Map<string, defined>, args: Array<defined>, executor: Player) {
		const remapped: Record<string, defined> = {};
		for (const [name, opt] of mappedOptions) {
			const option = this.options[name];
			if (option !== undefined) {
				const { type } = option;
				if (isCmdTypeDefinition(type)) {
					if (!typeIs(opt, "string")) {
						throw `Invalid type for custom value`;
					}

					const value = type.transform?.(opt, executor) ?? opt;
					const valid = type.validate?.(value, executor) ?? { success: true };
					if (valid.success === false) {
						throw `[CommandExecutor] Failed to execute command: ${valid.reason}`;
					}
					const result = type.parse(value);
					remapped[name] = result;
				} else {
					remapped[name] = opt;
				}
			}
		}

		return this.execute(remapped as Mapped<K>, args, executor);
	}

	public abstract execute(options: Mapped<K>, args: defined, executor: Player): unknown;

	/**
	 * @internal
	 */
	public getInterpreterArguments(): ("string" | "number" | "boolean")[] {
		return [];
	}

	/**
	 * @internal
	 */
	public getCommandDeclaration(): CommandDeclaration {
		return {
			command: this.command,
			options: this.getInterpreterOptions(),
			args: this.getInterpreterArguments(),
		};
	}

	public static create<K extends Record<string, Option>, R>(dec: Declaration<K, R>) {
		return new (class extends Command<K> {
			constructor() {
				super({
					command: dec.command,
					options: dec.options,
					args: dec.args ?? ([] as ArgType[]),
					groups: dec.groups ?? ([] as CommandGroup[]),
				});
			}

			public execute(options: Mapped<K>, args: defined[], executor: Player) {
				return dec.execute({Options: options, Arguments: args}, executor);
			}
		})();
	}
}

export interface ExecutionArgs<K extends Record<string, Option>, A> {
	Options: Mapped<K>;
	Arguments: A;
}

export interface Declaration<K extends Record<string, Option>, R> {
	command: string;
	options: K;
	groups?: CommandInfo<K>["groups"];
	args?: CommandInfo<K>["args"];
	execute(args: ExecutionArgs<K, defined>, executor: Player): R;
}
