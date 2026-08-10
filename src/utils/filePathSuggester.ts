


export function filePathSuggest(userInput: string, paths: string[], caseSensitive: boolean = false): string[] {
  if (userInput.length === 0) return [];

  // Step 1: Calculate relevance and specificity for each path
  const scoredPaths = paths.map((path) => {
    let maxOverlap = 0;
    let specificity = 0;

    const comparePath = caseSensitive ? path : path.toLowerCase(); // Use case-sensitive or insensitive path
    const compareInput = caseSensitive ? userInput : userInput.toLowerCase(); // Use case-sensitive or insensitive user input

    for (let i = 0; i <= comparePath.length - compareInput.length; i++) {
      const substring = comparePath.substring(i, i + compareInput.length);

      if (substring === compareInput) {
        maxOverlap = compareInput.length;
        specificity = comparePath.length - (i + compareInput.length);
        break;
      }
    }

    return { path, maxOverlap, specificity };
  });

  // Step 1.5: Filter out paths that don't have a full match
  const filteredPaths = scoredPaths.filter((scoredPath) => scoredPath.maxOverlap === (caseSensitive ? userInput : userInput.toLowerCase()).length);

  // Step 2: Sort by relevance and then by specificity
  filteredPaths.sort((a, b) => {
    if (b.maxOverlap !== a.maxOverlap) {
      return b.maxOverlap - a.maxOverlap;
    }
    return a.specificity - b.specificity;
  });

  // Step 3: Extract the sorted paths with their original case
  const sortedPaths = filteredPaths.map((scoredPath) => scoredPath.path);

  return sortedPaths;
}
