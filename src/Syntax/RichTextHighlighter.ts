import ZrTextStream from "TextStream";
import ZrLexer from "Lexer";
import { isToken, ZrTokenFlag, ZrTokenKind } from "Tokens/Tokens";

interface ZrThemeOptions {
	VariableColor: string;
	KeywordColor: string;
	NumberColor: string;
	StringColor: string;
	OperatorColor: string;
	CommentColor?: string;
	BooleanLiteral?: string;
	ControlCharacters: string;
}

const DARK_THEME: ZrThemeOptions = {
	VariableColor: "#B57EDC",
	KeywordColor: "#57AFE3",
	NumberColor: "#56B6C2",
	StringColor: "#79C36C",
	OperatorColor: "#5F6672",
	BooleanLiteral: "#56B6C2",
	ControlCharacters: "rgb(50, 50, 50)",
	// CommentColor: "#5F6672",
};

function font(text: string, color: string) {
	return `<font color="${color}">${text}</font>`;
}

export default class ZrRichTextHighlighter {
	private lexer: ZrLexer;
	constructor(source: string, private options: ZrThemeOptions = DARK_THEME) {
		const stream = new ZrTextStream(source);
		this.lexer = new ZrLexer(stream, { ParseCommentsAsTokens: true, ParseWhitespaceAsTokens: true });
	}

	public parse2() {
		let str = "";
		const { options } = this;
		while (this.lexer.hasNext()) {
			const token = this.lexer.next();
			if (!token) break;

			switch (token.kind) {
				case ZrTokenKind.Boolean:
					str += font(token.rawText, options.BooleanLiteral ?? options.OperatorColor);
					break;
				case ZrTokenKind.Keyword:
					break;
				default:
					str += token.value;
			}
		}
		return str;
	}

	public parse() {
		let str = "";
		const { options } = this;

		while (this.lexer.hasNext()) {
			const token = this.lexer.next();

			if (!token) break;

			if (isToken(token, ZrTokenKind.Boolean))
				str += font(token.rawText, options.BooleanLiteral ?? options.OperatorColor);
			else if (isToken(token, ZrTokenKind.String)) {
				const { quotes, value, flags } = token;
				if (quotes !== undefined) {
					const isTerminated = (flags & ZrTokenFlag.UnterminatedString) === 0;
					str += font(
						`${quotes}${font(value, options.StringColor)}${isTerminated ? quotes : ""}`,
						options.OperatorColor,
					);
				} else {
					if (flags !== undefined && (flags & ZrTokenFlag.FunctionName) !== 0) {
						str += font(value, options.VariableColor);
					} else if ((flags & ZrTokenFlag.Label) !== 0) {
						str += font(value, options.VariableColor);
					} else {
						str += value;
					}
				}
			} else if (isToken(token, ZrTokenKind.InterpolatedString)) {
				const { values, variables, quotes } = token;
				const resulting = new Array<string>();
				for (let k = 0; k < values.size(); k++) {
					const v = values[k];
					resulting.push(font(v, options.StringColor));

					const matchingVar = variables[k];
					if (matchingVar !== undefined) {
						resulting.push(font(`$${matchingVar}`, options.VariableColor));
					}
				}
				str += font(
					`${quotes}${font(resulting.join(""), options.StringColor)}${quotes}`,
					options.OperatorColor,
				);
			} else if (isToken(token, ZrTokenKind.Number)) str += font(token.rawText, options.NumberColor);
			else if (isToken(token, ZrTokenKind.Identifier))
				if ((token.flags & ZrTokenFlag.FunctionName) !== 0) {
					str += font(`${token.value}`, options.NumberColor);
				} else {
					str += font(`$${token.value}`, options.VariableColor);
				}
			else if (isToken(token, ZrTokenKind.Operator) || isToken(token, ZrTokenKind.Special))
				str += font(token.value, options.OperatorColor);
			else if (isToken(token, ZrTokenKind.Keyword)) str += font(token.value, options.KeywordColor);
			else if (isToken(token, ZrTokenKind.EndOfStatement)) {
				if (token.value === "\n") {
					str += font("¬", options.ControlCharacters);
					str += token.value;
				} else {
					str += token.value;
				}
			} else if (isToken(token, ZrTokenKind.Whitespace)) {
				if (token.value === " ") {
					str += font("·", options.ControlCharacters);
				} else {
					str += token.value;
				}
			} else if (isToken(token, ZrTokenKind.Option))
				str += font(`${token.prefix ?? ""}${token.value}`, options.KeywordColor);
			else if (isToken(token, ZrTokenKind.PropertyAccess)) {
				str += font(`$${token.value}`, options.VariableColor);
				for (const prop of token.properties) {
					str +=
						font(".", options.OperatorColor) +
						(prop.match("%d+")[0] !== undefined
							? font(prop, options.NumberColor)
							: font(prop, options.VariableColor));
				}
			} else if (isToken(token, ZrTokenKind.Comment))
				str += font(token.value, options.CommentColor ?? options.OperatorColor);
			else str += tostring(token.value);
		}

		return str;
	}
}
