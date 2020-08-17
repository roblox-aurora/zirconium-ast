import { Node } from "Nodes/NodeTypes";
import { isStringExpression, isNumberLiteral, isBooleanLiteral } from "Nodes/Guards";

/* eslint-disable @typescript-eslint/no-empty-interface */
export type AstPrimitiveType = "string" | "number" | "boolean" | "switch";

interface AstBaseDefinition {
	readonly type: readonly AstPrimitiveType[];
}

export interface AstArgumentDefinition extends AstBaseDefinition {}
export interface AstOptionDefinition extends AstBaseDefinition {}

export interface AstCommandDefinition {
	readonly command: string;
	readonly options: Readonly<Record<string, AstOptionDefinition>>;
	readonly args: readonly AstPrimitiveType[];
	readonly children?: readonly AstCommandDefinition[];
}
export type AstCommandDefinitions = readonly AstCommandDefinition[];

type MatchResult = { matches: true; matchType: AstPrimitiveType } | { matches: false };
export function nodeMatchesAstDefinition(node: Node, types: readonly AstPrimitiveType[]): MatchResult {
	for (const type of types) {
		if (type === "string" && isStringExpression(node)) {
			return { matches: true, matchType: type };
		} else if (type === "number" && isNumberLiteral(node)) {
			return { matches: true, matchType: type };
		} else if (type === "boolean" && isBooleanLiteral(node)) {
			return { matches: true, matchType: type };
		} else if (type === "switch") {
			return { matches: true, matchType: type };
		}
	}

	return { matches: false };
}
