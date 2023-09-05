


export function filePathSuggest(userInput: string, paths: string[]): string[] {
    if (userInput.length === 0) return [];

    // Step 1: Calculate relevance and specificity for each path
    const scoredPaths = paths.map((path) => {
      let maxOverlap = 0;
      let specificity = 0;
  
      for (let i = 0; i <= path.length - userInput.length; i++) {
        const substring = path.substring(i, i + userInput.length);
  
        if (substring === userInput) {
          maxOverlap = userInput.length;
          specificity = path.length - (i + userInput.length);
          break;
        }
      }
  
      return { path, maxOverlap, specificity };
    });
  
    // Step 1.5: Filter out paths that don't have a full match
    const filteredPaths = scoredPaths.filter((scoredPath) => scoredPath.maxOverlap === userInput.length);
  
    // Step 2: Sort by relevance and then by specificity
    filteredPaths.sort((a, b) => {
      if (b.maxOverlap !== a.maxOverlap) {
        return b.maxOverlap - a.maxOverlap;
      }
      return a.specificity - b.specificity;
    });
  
    // Step 3: Extract the sorted paths
    const sortedPaths = filteredPaths.map((scoredPath) => scoredPath.path);
  
    return sortedPaths;
  }
  