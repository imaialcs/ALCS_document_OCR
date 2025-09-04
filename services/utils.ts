export const readFileAsBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

export const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result as ArrayBuffer);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};

export const levenshteinDistance = (a: string, b: string): number => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
};

export const findBestMatch = (name: string, roster: string[]): string | null => {
    if (!roster || roster.length === 0 || !name) return null;

    let bestMatch: string | null = null;
    let minDistance = Infinity;
    const similarityThreshold = 0.7; // 70% similarity required

    const normalizedName = name.replace(/\s+/g, '');

    for (const rosterName of roster) {
        const normalizedRosterName = rosterName.replace(/\s+/g, '');
        const distance = levenshteinDistance(normalizedName, normalizedRosterName);
        const similarity = 1 - distance / Math.max(normalizedName.length, normalizedRosterName.length);

        if (similarity > similarityThreshold && distance < minDistance) {
            minDistance = distance;
            bestMatch = rosterName;
        }
    }
    return bestMatch;
};

export const columnToIndex = (col: string): number => {
    let index = 0;
    const upperCol = col.toUpperCase();
    for (let i = 0; i < upperCol.length; i++) {
        index = index * 26 + upperCol.charCodeAt(i) - 'A'.charCodeAt(0) + 1;
    }
    return index - 1;
};

export const findMatchingSheetName = (fullName: string, sheetNames: string[]): string | null => {
    if (!fullName || sheetNames.length === 0) {
        return null;
    }

    const trimmedFullName = fullName.trim();
    const nameParts = trimmedFullName.split(/[　 ]+/ ).filter(p => p);

    if (nameParts.length === 0) {
        return null;
    }

    const normalizedSheetNames = sheetNames.map(s => s.trim());

    let foundIndex = normalizedSheetNames.findIndex(sheet => sheet === trimmedFullName);
    if (foundIndex > -1) return sheetNames[foundIndex];

    const firstNamePart = nameParts[0];
    foundIndex = normalizedSheetNames.findIndex(sheet => sheet === firstNamePart);
    if (foundIndex > -1) return sheetNames[foundIndex];
    
    if (nameParts.length > 1) {
        const lastNamePart = nameParts[nameParts.length - 1];
        foundIndex = normalizedSheetNames.findIndex(sheet => sheet === lastNamePart);
        if (foundIndex > -1) return sheetNames[foundIndex];
    }

    return null;
};
