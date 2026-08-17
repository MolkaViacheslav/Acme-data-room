/**
 * Splits `report.pdf` into `report` and `.pdf`.
 *
 * A leading dot is part of the stem: `.env` is a name, not an extension.
 */
export function splitName(name: string): { stem: string; extension: string } {
  const lastDot = name.lastIndexOf('.');

  if (lastDot <= 0) return { stem: name, extension: '' };

  return { stem: name.slice(0, lastDot), extension: name.slice(lastDot) };
}

/**
 * The next free `name (n)` variant, given the names already in the folder.
 *
 * `report.pdf` -> `report (2).pdf` -> `report (3).pdf`
 *
 * Offered in the 409 body so the client can show "rename to …" instead of
 * making the user invent a name.
 */
export function suggestAvailableName(desiredName: string, takenNames: Iterable<string>): string {
  const taken = new Set<string>();
  for (const name of takenNames) taken.add(name.toLowerCase());

  if (!taken.has(desiredName.toLowerCase())) return desiredName;

  const { stem, extension } = splitName(desiredName);

  // Strip an existing counter so "report (2).pdf" suggests "report (3).pdf"
  // rather than "report (2) (2).pdf".
  const counted = /^(.*?)\s\((\d+)\)$/.exec(stem);
  const baseStem = counted?.[1] ?? stem;

  for (let counter = 2; counter < 1000; counter += 1) {
    const candidate = `${baseStem} (${counter})${extension}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }

  // Practically unreachable; a timestamp beats failing to suggest anything.
  return `${baseStem} (${Date.now()})${extension}`;
}
