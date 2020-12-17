import { ZrNodeKind } from "./Enum";
import { Node, ParentNode, BooleanLiteral } from "./NodeTypes";

export function getKindName(kind: ZrNodeKind | undefined) {
	if (kind === undefined) {
		return "<none>";
	}

	return ZrNodeKind[kind];
}

export function getFriendlyName(node: Node, isConst = false) {
	if (node.kind === ZrNodeKind.String || node.kind === ZrNodeKind.InterpolatedString) {
		return "string";
	} else if (node.kind === ZrNodeKind.Number) {
		return "number";
	} else if (node.kind === ZrNodeKind.Boolean) {
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

export function isParentNode(node: Node): node is ParentNode {
	return "children" in node;
}

// export function getNextNode(node: Node): Node | undefined {
// 	const { parent } = node;
// 	if (parent && isParentNode(parent)) {
// 		const index = parent.children.indexOf(node) + 1;
// 		return parent.children[index];
// 	}
// }

// export function getPreviousNode(node: Node): Node | undefined {
// 	const { parent } = node;
// 	if (parent && isParentNode(parent)) {
// 		const index = parent.children.indexOf(node) - 1;
// 		return parent.children[index];
// 	}
// }
