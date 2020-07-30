import t from "@rbxts/t";

export const enum CmdPrimitiveType {
	String = "string",
	Number = "number",
	Boolean = "boolean",
	Switch = "switch",
}

export const enum CmdType {
	Player = "player",
	Players = "players",
}

interface ValidationSuccessResult {
	success: true;
}
interface ValidationFailResult {
	success: false;
	reason: string;
}

export type ValidationResult = ValidationSuccessResult | ValidationFailResult;

const _isCmdTypeDefinition = t.interface({
	parse: t.callback,
	transform: t.optional(t.callback),
	validate: t.optional(t.callback),
	displayName: t.optional(t.string),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isCmdTypeDefinition(value: unknown): value is CmdTypeDefinition<unknown, unknown> {
	return _isCmdTypeDefinition(value);
}

export interface CmdTypeDefinition<T = string, R = T> {
	displayName?: string;

	validate?(value: T, executor: Player): ValidationResult;

	/**
	 *
	 * @param value The string representation
	 * @returns The transformed representation
	 */
	transform?(value: string, executor: Player): T;

	parse(value: T): R;
}
