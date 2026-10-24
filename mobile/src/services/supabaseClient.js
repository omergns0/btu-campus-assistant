import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { APP_CONFIG } from '../config/appConfig';

// Web sitesiyle aynı Supabase projesi: aynı hesap, aynı ders taslağı.
// Yayınlanabilir (anon) anahtar herkese açık olacak şekilde tasarlanmıştır;
// veriler Row Level Security ile korunur (bkz. supabase_setup.sql).
export const supabase = createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Uygulama ön plandayken oturum jetonu otomatik yenilenir
AppState.addEventListener('change', state => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

export function translateAuthError(err) {
  const msg = (err && (err.message || err.error_description || String(err))) || '';
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-posta veya şifre hatalı.';
  if (m.includes('email not confirmed')) return 'E-posta adresiniz henüz doğrulanmamış.';
  if (m.includes('user already registered')) return 'Bu e-posta adresi zaten kayıtlı.';
  if (m.includes('password should be at least')) return 'Şifre en az 6 karakter olmalıdır.';
  if (m.includes('token has expired') || m.includes('otp_expired') || m.includes('invalid')) return 'Kod hatalı veya süresi dolmuş. Yeni kod isteyebilirsiniz.';
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes')) return 'Çok fazla deneme yapıldı. Lütfen biraz bekleyip tekrar deneyin.';
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'Geçerli bir e-posta adresi girin.';
  if (m.includes('network') || m.includes('fetch')) return 'Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.';
  return msg || 'Beklenmeyen bir hata oluştu.';
}
