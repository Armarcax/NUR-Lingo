// src/lib/dictionary.ts
// ✅ ԲԱՌԱՐԱՆՆԵՐԻ ԿԱՌԱՎԱՐՄԱՆ ՄՈԴՈՒԼ

import baseDict from "../../data/dictionaries/unified-dictionary.json";

// ✅ Հիմնական բառարանից բեռնել
export interface DictionaryEntry {
  id: string;
  hy: string;
  en: string;
  ru: string;
  type: string;
  isUserAdded?: boolean;
  original_id?: string;
}

// ✅ ՀԻՄՆԱԿԱՆ ԲԱՌԱՐԱՆ (1152 բառ, չի փոխվում)
export const baseDictionary = baseDict as DictionaryEntry[];

// ✅ ՕԳՏԱՏԵՐԻ ԲԱՌԱՐԱՆ (բեռնվում է localStorage-ից կամ JSON-ից)
let userDictionary: DictionaryEntry[] = [];

// ✅ Օգտատերերի բառարանը բեռնել
export const loadUserDictionary = (): DictionaryEntry[] => {
  try {
    // 1. Փորձել localStorage-ից
    const local = localStorage.getItem("user_dictionary");
    if (local) {
      userDictionary = JSON.parse(local);
      return userDictionary;
    }
  } catch (e) {
    console.warn("⚠️ localStorage-ից բեռնել չհաջողվեց");
  }

  // 2. Փորձել JSON ֆայլից (server-side)
  try {
    // Next.js-ում fetch-ով
    fetch("/data/dictionaries/user-dictionary.json")
      .then((res) => {
        if (res.ok) return res.json();
        return [];
      })
      .then((data) => {
        userDictionary = data;
        return data;
      })
      .catch(() => []);
  } catch (e) {
    console.warn("⚠️ JSON-ից բեռնել չհաջողվեց");
  }

  return userDictionary;
};

// ✅ Օգտատերերի բառարանը պահպանել
export const saveUserDictionary = (dict: DictionaryEntry[]): void => {
  try {
    localStorage.setItem("user_dictionary", JSON.stringify(dict));
    userDictionary = dict;
  } catch (e) {
    console.warn("⚠️ localStorage-ում պահպանել չհաջողվեց");
  }
};

// ✅ Ավելացնել նոր բառ օգտատերերի բառարանում
export const addToUserDictionary = (
  hy: string,
  en: string,
  ru: string,
  type: string = "user"
): DictionaryEntry | null => {
  // Ստուգել, արդյոք բառն արդեն կա հիմնական բառարանում
  if (isInBaseDictionary(hy)) {
    console.warn(`⚠️ "${hy}" արդեն կա հիմնական բառարանում`);
    return null;
  }

  // Ստուգել, արդյոք բառն արդեն կա օգտատերերի բառարանում
  if (isInUserDictionary(hy)) {
    console.warn(`⚠️ "${hy}" արդեն կա օգտատերերի բառարանում`);
    return null;
  }

  // Ստեղծել նոր ID
  const maxId = userDictionary.reduce((max, item) => {
    const num = parseInt(item.id);
    return num > max ? num : max;
  }, 900000);
  const newId = String(maxId + 1).padStart(6, "0");

  const newEntry: DictionaryEntry = {
    id: newId,
    hy,
    en,
    ru,
    type,
    isUserAdded: true,
  };

  userDictionary.push(newEntry);
  saveUserDictionary(userDictionary);
  console.log(`✅ "${hy}" ավելացվել է օգտատերերի բառարանում (ID: ${newId})`);
  return newEntry;
};

// ✅ Ստուգել, արդյոք բառը հիմնական բառարանում է
export const isInBaseDictionary = (word: string): boolean => {
  return baseDictionary.some(
    (item) => item.hy === word || item.en === word || item.ru === word
  );
};

// ✅ Ստուգել, արդյոք բառը օգտատերերի բառարանում է
export const isInUserDictionary = (word: string): boolean => {
  return userDictionary.some(
    (item) => item.hy === word || item.en === word || item.ru === word
  );
};

// ✅ Ստանալ ամբողջական բառարանը (հիմնական + օգտատերերի)
export const getFullDictionary = (): DictionaryEntry[] => {
  return [...baseDictionary, ...userDictionary];
};

// ✅ Ստանալ միայն օգտատերերի ավելացրած բառերը
export const getUserAddedWords = (): DictionaryEntry[] => {
  return userDictionary.filter((item) => item.isUserAdded);
};

// ✅ Ջնջել բառը օգտատերերի բառարանից
export const removeFromUserDictionary = (id: string): boolean => {
  const index = userDictionary.findIndex((item) => item.id === id);
  if (index === -1) return false;
  userDictionary.splice(index, 1);
  saveUserDictionary(userDictionary);
  return true;
};

// ✅ Բեռնել բառարանը սկզբնավորման ժամանակ
loadUserDictionary();

export default {
  baseDictionary,
  userDictionary,
  loadUserDictionary,
  saveUserDictionary,
  addToUserDictionary,
  isInBaseDictionary,
  isInUserDictionary,
  getFullDictionary,
  getUserAddedWords,
  removeFromUserDictionary,
};