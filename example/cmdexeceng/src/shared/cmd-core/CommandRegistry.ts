import { CmdTypeDefinition } from "./CommandType";
import { PlayerType } from "./InternalTypes/Player";
import Command, { Option } from "./Command";
import CommandDispatch from "./CommandDispatch";

export default class CommandRegistry {
	private commands = new Array<Command<defined>>();
	private types = new Map<string, CmdTypeDefinition<defined>>();

	/** @internal */
	constructor() {
		// TODO
	}

	public getCommands(): ReadonlyArray<Command<defined>> {
		return this.commands;
	}

	public registerType<T, U>(name: string, type: CmdTypeDefinition<T, U>) {
		this.types.set(name, type);
	}

	private makeEnumType<T extends string>(name: string, values: T[]): CmdTypeDefinition<T> {
		return {
			displayName: `Enum(${name})`,
			validate(value) {
				if (values.includes(value as T)) {
					return { success: true };
				} else {
					return {
						success: false,
						reason: `'${value}' is not a valid value for ${name} - Expected ${values.join(", ")}`,
					};
				}
			},
			parse(value) {
				return value;
			},
		};
	}

	public registerEnumType<T extends string>(name: string, values: T[]) {
		const e = this.makeEnumType(name, values);
		this.types.set(name, e);
		return e;
	}

	public registerCommand<C extends Record<string, Option>>(command: Command<C>) {
		this.commands.push(command);
	}
}
