import { Node } from "Nodes/NodeTypes";
import { isNode } from "Nodes/Guards";
import { CmdSyntaxKind } from "Nodes";
import { getNodeKindName } from "Nodes/Functions";

export function prettyPrintNodes(nodes: Node[], prefix = "", verbose = false) {
	for (const node of nodes) {
		if (isNode(node, CmdSyntaxKind.CommandName)) {
			if (verbose) {
				print(
					prefix,
					CmdSyntaxKind[node.kind],
					node.name.text,
					`[${node.startPos}:${node.endPos}]`,
					`'${node.rawText}'`,
				);
			} else {
				print(prefix, CmdSyntaxKind[node.kind], node.name.text);
			}
		} else if (isNode(node, CmdSyntaxKind.String)) {
			const str = node.quotes !== undefined ? `${node.quotes}${node.text}${node.quotes}` : `\`${node.text}\``;
			if (verbose) {
				print(prefix, getNodeKindName(node), str, `[${node.startPos}:${node.endPos}]`, `{${node.rawText}}`);
			} else {
				print(prefix, CmdSyntaxKind[node.kind], str);
			}

			if (node.isUnterminated) {
				print(prefix, "Unterminated String");
			}
		} else if (isNode(node, CmdSyntaxKind.InnerExpression)) {
			if (verbose) {
				print(prefix, CmdSyntaxKind[node.kind], `'${node.rawText}'`, `[${node.startPos}:${node.endPos}]`, "{");
			} else {
				print(prefix, CmdSyntaxKind[node.kind], "{");
			}

			prettyPrintNodes([node.expression], prefix + "\t", verbose);

			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.CommandStatement)) {
			if (verbose) {
				print(prefix, CmdSyntaxKind[node.kind], `'${node.rawText}'`, `[${node.startPos}:${node.endPos}]`, "{");
			} else {
				print(prefix, CmdSyntaxKind[node.kind], "{");
			}

			prettyPrintNodes(node.children, prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.Number) || isNode(node, CmdSyntaxKind.Boolean)) {
			if (verbose) {
				print(
					prefix,
					CmdSyntaxKind[node.kind],
					node.value,
					`'${node.rawText}'`,
					`[${node.startPos}:${node.endPos}]`,
				);
			} else {
				print(prefix, CmdSyntaxKind[node.kind], node.value);
			}
		} else if (isNode(node, CmdSyntaxKind.Option)) {
			print(prefix, CmdSyntaxKind[node.kind], node.flag);
			prettyPrintNodes([node.right!], prefix + "\t", verbose);
		} else if (isNode(node, CmdSyntaxKind.Identifier)) {
			if (verbose) {
				print(
					prefix,
					CmdSyntaxKind[node.kind],
					node.name,
					`'${node.rawText}'`,
					`[${node.startPos}:${node.endPos}]`,
				);
			} else {
				print(prefix, CmdSyntaxKind[node.kind], node.name);
			}
		} else if (isNode(node, CmdSyntaxKind.OperatorToken)) {
			print(prefix, CmdSyntaxKind[node.kind], node.operator);
		} else if (isNode(node, CmdSyntaxKind.BinaryExpression)) {
			if (verbose) {
				print(prefix, CmdSyntaxKind[node.kind], `'${node.rawText}'`, `[${node.startPos}:${node.endPos}]`, "{");
			} else {
				print(prefix, CmdSyntaxKind[node.kind], "{");
			}

			prettyPrintNodes([node.left, node.operator, node.right], prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.InterpolatedString)) {
			if (verbose) {
				print(prefix, CmdSyntaxKind[node.kind], `'${node.rawText}'`, `[${node.startPos}:${node.endPos}]`, "{");
			} else {
				print(prefix, CmdSyntaxKind[node.kind], "{");
			}

			prettyPrintNodes(node.values, prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.Source)) {
			if (verbose) {
				print(prefix, CmdSyntaxKind[node.kind], `[${node.startPos}:${node.endPos}]`, "{");
			} else {
				print(prefix, CmdSyntaxKind[node.kind], "{");
			}

			prettyPrintNodes(node.children, prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.PrefixToken)) {
			print(prefix, CmdSyntaxKind[node.kind], node.value);
		} else if (isNode(node, CmdSyntaxKind.PrefixExpression)) {
			print(prefix, CmdSyntaxKind[node.kind], "{");
			prettyPrintNodes([node.prefix, node.expression], prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.VariableDeclaration)) {
			print(prefix, CmdSyntaxKind[node.kind], "{");
			prettyPrintNodes([node.identifier, node.expression], prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.VariableStatement)) {
			print(prefix, CmdSyntaxKind[node.kind], "{");
			prettyPrintNodes([node.declaration], prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.EndOfStatement)) {
			print(prefix, "EndOfStatement");
		} else if (isNode(node, CmdSyntaxKind.Invalid)) {
			print(prefix, "SYNTAX ERROR", node.message);
		} else {
			print(getNodeKindName(node));
		}
	}
}
