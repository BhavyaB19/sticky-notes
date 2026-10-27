const MAX_LENGTH = 50;

// First non-empty line of a note, shortened for one-line lists
export function notePreview(content: string): string {
    const line = content
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.length > 0);
    if (!line) return '(empty note)';
    return line.length > MAX_LENGTH ? `${line.slice(0, MAX_LENGTH - 1).trimEnd()}…` : line;
}
