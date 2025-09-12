export const DEFAULT_PROMPT = `Extract all text from the provided sources, in the numerical order of the sources.

For each source:
	1.	Extract the full text.
	2.	Reconstruct the text into readable paragraphs. A new paragraph should begin where there is a clear break in the original text, such as a new line, indentation, or topic change. Do not merge paragraphs that are clearly separate in the source.
	3.	Ensure each distinct scripture passage is separated from the surrounding text by a blank line. For example, if the text contains "John 3:16" followed by commentary, the scripture should be a separate paragraph.
	4.	After the extracted and formatted text for the source, insert a blank line.
	5.	On the new line, append the page number. Use the printed page number visible in the image. If no page number is visible, infer one based on the order provided (Page 1, Page 2, ...).
	6.	Format the page number as: **Page [number]**
	7.	Format bold text in the source in **bold**.

Example formatting:
[Extracted and formatted text of the source, with paragraphs and scripture passages separated correctly.]

**Page 1**`;

export const DEFAULT_PROMPT_AUDIO = `Edit the source, correcting all typographical, grammatical, and spelling errors while maintaining the original style and emphasis.

Ensure all biblical references:
- Use exact KJV wording.
- Are explicitly quoted in full including those referenced in passive.
- Formatted in isolation with verse numbers, with the reference line in bold and verses in normal weight, e.g.:

**Genesis 12:2-3 - KJV**
2. And I will make of thee a great nation, and I will bless thee, and make thy name great; and thou shalt be a blessing:
3. And I will bless them that bless thee, and curse him that curseth thee: and in thee shall all families of the earth be blessed.

Correct all Hebrew and Greek words with proper transliterations.

Remove all verbal fillers ("uh", "um", etc.) while preserving the complete content and meaning.

Maintain all of the author's:
- Teaching points
- Rhetorical devices
- Emphasis patterns
- Illustrative examples
- Call-and-response elements

Format the text with:
- Consistent punctuation
- Proper capitalization
- Original paragraph structure
- Clear scripture demarcation
- Smart quotes`;
