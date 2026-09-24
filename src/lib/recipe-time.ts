/**
 * The only place total time is derived. The seed, the service's
 * createRecipe() and STORY-043's admin builder all go through it, so the
 * stored Recipe.totalTimeMinutes can never drift from prep + cook.
 */
export function computeTotalTimeMinutes(prepTimeMinutes: number, cookTimeMinutes: number): number {
  return prepTimeMinutes + cookTimeMinutes;
}

/** "45 min", "1 hr", "1 hr 30 min". */
export function formatRecipeTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}
