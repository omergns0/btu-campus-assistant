// Gizli anahtarlar kaynak koda yazılmaz: mobile/.env.local dosyasından okunur
// (bkz. .env.example). Uygulama içinden kullanıcı kendi anahtarını da girebilir.
export const APP_CONFIG = {
  GEMINI_API_KEY: process.env.EXPO_PUBLIC_GEMINI_API_KEY || '',
  GEMINI_MODEL: "gemini-3.1-flash-lite",
  GEMINI_FALLBACK_MODELS: [
    "gemini-3.1-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash"
  ],
  SUPABASE_URL: "https://lgdddnhxdpmjzegotxmu.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_4tn02rFpOCaxvVc3mLBv1g_SaKOW_MA",
  APP_TITLE: "BTÜ Kampüs Asistanı",
  VERSION: "1.2.0"
};
