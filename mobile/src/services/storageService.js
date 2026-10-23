import AsyncStorage from '@react-native-async-storage/async-storage';

const PLAN_KEY = '@btu_user_planned_courses_v1';
const DEPT_KEY = '@btu_favorite_department_v1';
const PROGRAM_KEY = '@btu_favorite_program_v1';
const API_KEY = '@btu_gemini_api_key_v1';
const DISCLAIMER_KEY = '@btu_disclaimer_ack_v1';

async function getString(key) {
  try {
    return await AsyncStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

async function setString(key, value) {
  try {
    if (value) await AsyncStorage.setItem(key, value);
    else await AsyncStorage.removeItem(key);
    return true;
  } catch (e) {
    return false;
  }
}

export const StorageService = {
  async savePlan(plan) {
    try {
      // Saat bilgisi (slots) program verisinden yeniden üretildiği için kaydedilmez
      const slim = plan.map(({ slots, ...rest }) => rest);
      await AsyncStorage.setItem(PLAN_KEY, JSON.stringify(slim));
      return true;
    } catch (e) {
      console.error('Failed to save plan', e);
      return false;
    }
  },

  async loadPlan() {
    try {
      const data = await AsyncStorage.getItem(PLAN_KEY);
      const parsed = data ? JSON.parse(data) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Failed to load plan', e);
      return [];
    }
  },

  // Sınav ekranında "Bölümüm" olarak seçilen bölüm anahtarı (ör. "bilgisayar")
  saveFavoriteDepartment: dept => setString(DEPT_KEY, dept),
  getFavoriteDepartment: () => getString(DEPT_KEY),

  // Ders programı ekranında en son seçilen program
  saveFavoriteProgram: prog => setString(PROGRAM_KEY, prog),
  getFavoriteProgram: () => getString(PROGRAM_KEY),

  // "Öğrenci projesi / test aşaması" bilgilendirmesi bir kez onaylandı mı
  saveDisclaimerAck: () => setString(DISCLAIMER_KEY, '1'),
  getDisclaimerAck: () => getString(DISCLAIMER_KEY),

  saveApiKey: key => setString(API_KEY, key),
  getApiKey: () => getString(API_KEY),
};
