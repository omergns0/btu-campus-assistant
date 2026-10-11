// ============================================================
// Google Gemini API Yapılandırması
// ------------------------------------------------------------
// Varsayılan API anahtarı ve model tanımları:
// ============================================================
window.GEMINI_CONFIG = {
  // Varsayılan anahtar (LocalStorage veya dahili şifreli anahtar)
  GEMINI_API_KEY: (function () {
    try {
      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem("btu_gemini_api_key");
        if (stored && stored.trim()) return stored.trim();
      }
      if (typeof atob === "function") {
        return atob("QVEuQWI4Uk42TEJVX0ZIcWJBaW9HTmtJVDllbzhvWU16Y2VqLTFMa3M2c0NkcVF4Nmc4aFE=");
      }
      return "";
    } catch (e) {
      return "";
    }
  })(),
  MODEL: "gemini-flash-latest"
};
