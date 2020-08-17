export interface AstCommandDefinition {
	command: string;
	children?: readonly AstCommandDefinition[];
}
export type AstCommandDefinitions = readonly AstCommandDefinition[];
