import { Node, NodeError } from "Nodes";

interface ValidationSuccess {
	success: true;
}
interface ValidationFailure {
	success: false;
	errorNodes: NodeError[];
}
export type ValidationResult = ValidationSuccess | ValidationFailure;
