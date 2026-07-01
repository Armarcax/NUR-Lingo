// src/lib/dictionary.ts
// ✅ ԲԱՌԱՐԱՆՆԵՐԻ ԿԱՌԱՎԱՐՄԱՆ ՄՈԴՈՒԼ
// Re-exports from the new Dictionary Engine for backward compatibility

export {
  baseDictionary,
  getUserAddedWords,
  addToUserDictionary,
  removeFromUserDictionary,
  getFullDictionary,
  dictionaryEngine,
  type DictionaryEntry,
  type DictionaryTier,
  type WordType,
  type WordProgress,
  type SearchResult,
} from "./dictionary/engine";

// Legacy functions that use the old interface
import { dictionaryEngine, type WordType } from "./dictionary/engine";

export const loadUserDictionary = () => {
  // Engine auto-initializes
  return dictionaryEngine.getUserWords();
};

export const saveUserDictionary = (dict: any[]) => {
  // Handled internally by engine
  console.warn("saveUserDictionary is deprecated - use engine methods");
};

export const isInBaseDictionary = (word: string): boolean => {
  return dictionaryEngine.isVerified(word);
};

export const isInUserDictionary = (word: string): boolean => {
  const userWords = dictionaryEngine.getUserWords();
  return userWords.some(
    (item) => item.hy === word || item.en === word || item.ru === word
  );
};

export default {
  baseDictionary: dictionaryEngine.getVerified(),
  userDictionary: dictionaryEngine.getUserWords(),
  loadUserDictionary,
  saveUserDictionary,
  addToUserDictionary: (hy: string, en: string, ru: string, type?: WordType) =>
    dictionaryEngine.addUserWord(hy, en, ru, type),
  isInBaseDictionary,
  isInUserDictionary,
  getFullDictionary: () => dictionaryEngine.getAll(),
  getUserAddedWords: () => dictionaryEngine.getUserWords(),
  removeFromUserDictionary: (id: string) => dictionaryEngine.deleteUserWord(id),
};
