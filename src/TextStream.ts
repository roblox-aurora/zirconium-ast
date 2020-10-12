/**
 * A text stream
 */
export default class ZrTextStream {
	private ptr = 0;
	public constructor(private source: string) {}

	/**
	 * Consume and return the next character in the stream
	 */
	public next() {
		const char = this.source.sub(this.ptr, this.ptr);
		this.ptr++;
		return char;
	}

	/**
	 * Returns the next character in the stream without consuming it
	 */
	public peek() {
		const char = this.source.sub(this.ptr, this.ptr);
		return char;
	}

	/**
	 * Resets the stream pointer to the beginning.
	 */
	public reset() {
		this.ptr = 0;
	}

	/**
	 * Whether or not there's a next character in the stream
	 */
	public hasNext() {
		return this.source.size() > this.ptr;
	}
}
