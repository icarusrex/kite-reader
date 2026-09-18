export type KiteModuleId = 'reading' | 'math';

export interface KiteModuleMeta {
  id: KiteModuleId;
  title: string;
  emoji: string;
  description: string;
}

/**
 * Deliberately small registry: Kite is modular at the product boundary, not a plugin platform.
 * Pedagogy, mastery, curriculum and session planning stay inside each module.
 */
export const KITE_MODULES: readonly KiteModuleMeta[] = [
  { id: 'reading', title: 'Reading', emoji: '📖', description: 'Sounds, words and stories' },
  { id: 'math', title: 'Math', emoji: '🔢', description: 'Numbers, shapes and measuring' },
] as const;
