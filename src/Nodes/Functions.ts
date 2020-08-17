import { CmdSyntaxKind } from "./Enum";
import { Node, ParentNode, BooleanLiteral } from "./NodeTypes";

export function getKindName(kind: CmdSyntaxKind | undefined) {
	if (kind === undefined) {
		return "<none>";
	}

	return CmdSyntaxKind[kind];
}

export function getFriendlyName(node: Node, isConst = false) {
	if (node.kind === CmdSyntaxKind.String || node.kind === CmdSyntaxKind.InterpolatedString) {
		return "string";
	} else if (node.kind === CmdSyntaxKind.Number) {
		return "number";
	} else if (node.kind === CmdSyntaxKind.Boolean) {
		return isConst ? (node as BooleanLiteral).value : "boolean";
	}

	return getKindName(node.kind);
}

export function getNodeKindName(node: Node) {
	if (node === undefined) {
		return "<none>";
	}

	return getKindName(node.kind);
}

export function offsetNodePosition(node: Node, offset: number) {
	if (node.startPos !== undefined && node.endPos !== undefined) {
		node.startPos += offset;
		node.endPos += offset;
	}

	if ("children" in node) {
		for (const child of node.children) {
			offsetNodePosition(child, offset);
		}
	} else if ("values" in node) {
		for (const child of node.values) {
			offsetNodePosition(child, offset);
		}
	} else if ("expression" in node) {
		offsetNodePosition(node.expression, offset);
	}
}

export function isParentNode(node: Node): node is ParentNode {
	return "children" in node;
}

export function getNextNode(node: Node): Node | undefined {
	const { parent } = node;
	if (parent && isParentNode(parent)) {
		const index = parent.children.indexOf(node) + 1;
		return parent.children[index];
	}
}

export function getPreviousNode(node: Node): Node | undefined {
	const { parent } = node;
	if (parent && isParentNode(parent)) {
		const index = parent.children.indexOf(node) - 1;
		return parent.children[index];
	}
}
