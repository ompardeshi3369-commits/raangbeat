/**
 * Normalizes a song title by removing common metadata suffixes and cleaning characters.
 */
export function normalizeTitle(title: string): string {
    if (!title) return "";

    return title
        .toLowerCase()
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#039;/g, "'")
        // Remove content in parentheses like (From "Movie"), (feat. X), (LP Version), etc.
        .replace(/\(feat\..*?\)/g, "")
        .replace(/\(from.*?\)/g, "")
        .replace(/\(lp version.*?\)/g, "")
        .replace(/\(remastered.*?\)/g, "")
        .replace(/\(original.*?\)/g, "")
        .replace(/\(live.*?\)/g, "")
        .replace(/\(.*?\)/g, "") // Catch-all for other parentheses
        // Remove common search suffixes
        .replace(/ - from .*$/g, "")
        .replace(/ - title track.*$/g, "")
        .replace(/ - lp version.*$/g, "")
        .replace(/ - remastered.*$/g, "")
        .replace(/ - original.*$/g, "")
        .replace(/ - live.*$/g, "")
        // Clean up whitespace and special characters
        .replace(/[^\w\s&]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Normalizes an artist name by taking the first primary artist and cleaning.
 */
export function normalizeArtist(artist: string): string {
    if (!artist) return "";

    // Take first artist if comma-separated
    const firstArtist = artist.split(",")[0].split("&")[0].trim();

    return firstArtist
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Deduplicates a list of songs based on aggressive normalization.
 * Prioritizes the first occurrence in the list.
 */
export function deduplicateSongs<T extends { title: string; artist: string }>(songs: T[]): T[] {
    const seen = new Set<string>();
    const result: T[] = [];

    for (const song of songs) {
        const nTitle = normalizeTitle(song.title);
        if (!nTitle) continue;

        // Use a composite key: Title is primary, first prominent artist is secondary
        // But for "aggressive" mode, we might even just use Title if it's very specific
        // For now, let's keep Artist in the key but use normalizeArtist which is already quite strict
        const nArtist = normalizeArtist(song.artist);
        const key = `${nTitle}|${nArtist}`;

        if (!seen.has(key)) {
            seen.add(key);
            result.push(song);
        }
    }

    return result;
}

/**
 * Shuffles an array using the Fisher-Yates algorithm.
 */
export function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
