import Command, { Option } from "../Command";
import { CmdTypeDefinition } from "../CommandType";


export namespace CmdCoreRegistryService {
    const commands = new Array<Command<defined>>();
    const types = new Map<string, CmdTypeDefinition<defined>>();

	function makeEnumType<T extends string>(name: string, values: T[]): CmdTypeDefinition<T> {
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

	export function GetCommands(): ReadonlyArray<Command<defined>> {
		return commands;
	}

	/** @internal */
	export function _getCommandDeclarations() {
		return commands.map(c => c.getCommandDeclaration());
	}

    export function RegisterCommand<C extends Record<string, Option>>(command: Command<C>) {
        commands.push(command);
    }

	export function RegisterEnumType<T extends string>(name: string, values: T[]) {
		const e = makeEnumType(name, values);
		types.set(name, e);
		return e;
    }
    
    export function RegisterType<T, U>(name: string, type: CmdTypeDefinition<T, U>) {
        types.set(name, type);
    }

}
export type CmdCoreRegistryService = typeof CmdCoreRegistryService;