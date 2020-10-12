import ZrTextStream from "TextStream";
import { IdentifierToken, StringToken, Token, ZrTokenKind } from "Tokens/Tokens";

enum TokenCharacter {
	Hash = "#",
	Dollar = "$",
	DoubleQuote = '"',
	SingleQuote = "'",
}

/**
 * The lexer for Zirconium
 */
export default class ZrLexer {
	private static readonly OPERATORS = ["&", "|", "=", ">", "<"];
	private static readonly KEYWORDS = ["if"];

	public constructor(private stream: ZrTextStream) {}

	private isNotNewline = (c: string) => c !== "\n";
	private isWhitespace = (c: string) => c.match("%s")[0] !== undefined && c !== "\n";
	private isId = (c: string) => c.match("[%w_]")[0] !== undefined;

	/**
	 * Reads the text stream until the specified character is found or the end of stream
	 */
	private readUntil(character: string) {
		let src = "";
		while (this.stream.hasNext() && this.stream.peek() !== character) {
			src += this.stream.next();
		}
		return src;
	}

	/**
	 * Reads while the specified condition is met, or the end of stream
	 */
	private readWhile(condition: (str: string) => boolean) {
		let src = "";
		while (this.stream.hasNext() && condition(this.stream.peek())) {
			src += this.stream.next();
		}
		return src;
	}

	/**
	 * Reads a comment
	 * `# comment example`
	 */
	private readComment() {
		const result = this.readWhile(this.isNotNewline);
		this.stream.next(); // nom the newline
		return result;
	}

	private readStringToken(startCharacter: string): StringToken {
		const result = this.readUntil(startCharacter);
		return {
			kind: ZrTokenKind.String,
			value: result,
			quotes: startCharacter,
		};
	}

	private readVariableToken(): IdentifierToken {
		// skip $
		this.stream.next();

		// read the id
		const id = this.readWhile(this.isId);

		// Return the identifier
		return {
			kind: ZrTokenKind.Identifier,
			value: id,
		};
	}

	/**
	 * Gets the next token
	 */
	public next(): Token | undefined {
		if (!this.stream.hasNext()) return undefined;

		// skip whitespace
		this.readWhile(this.isWhitespace);

		// Get the next token
		const char = this.stream.peek();

		if (char === TokenCharacter.Hash) {
			this.readComment();
		}

		if (char === TokenCharacter.Dollar) {
			return this.readVariableToken();
		}

		// Handle double quote and single quote strings
		if (char === TokenCharacter.DoubleQuote || char === TokenCharacter.SingleQuote) {
			return this.readStringToken(char);
		}
	}
}
