import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { useAuth, displayName } from '../context/AuthContext';
import { usePlan } from '../context/PlanContext';

const RESEND_COOLDOWN = 60;

const TITLES = {
  login: ['Tekrar hoş geldin 👋', 'Taslaklarına web sitesi dahil her cihazdan erişmek için giriş yap.'],
  register: ['Hesap oluştur', 'Ücretsiz üye ol, ders taslağın hesabına kaydedilsin.'],
  verify: ['E-postanı doğrula', ''],
  forgot: ['Şifremi unuttum', 'E-posta adresine bir sıfırlama kodu gönderelim.'],
  recover: ['Yeni şifre belirle', ''],
};

function Field({ icon, secure, ...props }) {
  const [hidden, setHidden] = useState(!!secure);
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={18} color={COLORS.textDark} />
      <TextInput
        style={styles.input}
        placeholderTextColor={COLORS.textDark}
        secureTextEntry={hidden}
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
      />
      {secure && (
        <TouchableOpacity onPress={() => setHidden(h => !h)} hitSlop={8}>
          <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={18} color={COLORS.textDark} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function PrimaryButton({ label, onPress, loading, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.primaryBtn, (loading || disabled) && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={loading || disabled}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{label}</Text>}
    </TouchableOpacity>
  );
}

function AuthForms() {
  const auth = useAuth();
  const [view, setView] = useState('login');
  const [message, setMessage] = useState(null); // { text, type }
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => () => clearInterval(timer.current), []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) { clearInterval(timer.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const go = (v, msg = null) => {
    setView(v);
    setMessage(msg);
    setCode('');
  };

  const goVerify = (mail, notice) => {
    setPendingEmail(mail);
    go('verify', { text: notice, type: 'info' });
    startCooldown();
  };

  const withLoading = async fn => {
    setLoading(true);
    try { await fn(); } finally { setLoading(false); }
  };

  const handleLogin = () => withLoading(async () => {
    const mail = email.trim();
    if (!mail || !password) return setMessage({ text: 'E-posta ve şifrenizi girin.', type: 'error' });
    const { error, rawError } = await auth.signIn(mail, password);
    if (rawError && (rawError.message || '').toLowerCase().includes('email not confirmed')) {
      await auth.resendSignup(mail);
      return goVerify(mail, 'E-postanız henüz doğrulanmamış. Yeni bir onay kodu gönderdik.');
    }
    if (error) setMessage({ text: error, type: 'error' });
  });

  const handleRegister = () => withLoading(async () => {
    const mail = email.trim();
    if (!mail) return setMessage({ text: 'Geçerli bir e-posta adresi girin.', type: 'error' });
    if (password.length < 6) return setMessage({ text: 'Şifre en az 6 karakter olmalıdır.', type: 'error' });
    if (password !== password2) return setMessage({ text: 'Şifreler birbiriyle eşleşmiyor.', type: 'error' });
    const { data, error } = await auth.signUp(name.trim(), mail, password);
    if (error) return setMessage({ text: error, type: 'error' });
    // Supabase, kayıtlı ve doğrulanmış e-postalar için boş identities döndürür
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return setMessage({ text: 'Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.', type: 'error' });
    }
    if (data?.session) return; // e-posta doğrulaması kapalıysa oturum doğrudan açılır
    goVerify(mail, 'Onay kodu e-posta adresine gönderildi. Gelen kutunu (ve spam klasörünü) kontrol et.');
  });

  const handleVerify = () => withLoading(async () => {
    const token = code.replace(/\s/g, '');
    if (token.length < 6) return setMessage({ text: 'Lütfen e-postanıza gelen kodu eksiksiz girin.', type: 'error' });
    const { error } = await auth.verifySignup(pendingEmail, token);
    if (error) setMessage({ text: error, type: 'error' });
  });

  const handleResend = () => withLoading(async () => {
    const fn = view === 'recover' ? auth.sendReset : auth.resendSignup;
    const { error } = await fn(pendingEmail);
    if (error) return setMessage({ text: error, type: 'error' });
    setMessage({ text: 'Yeni kod gönderildi.', type: 'success' });
    startCooldown();
  });

  const handleForgot = () => withLoading(async () => {
    const mail = email.trim();
    if (!mail) return setMessage({ text: 'Geçerli bir e-posta adresi girin.', type: 'error' });
    const { error } = await auth.sendReset(mail);
    if (error) return setMessage({ text: error, type: 'error' });
    setPendingEmail(mail);
    setPassword('');
    go('recover', { text: 'Şifre sıfırlama kodu e-posta adresine gönderildi.', type: 'info' });
    startCooldown();
  });

  const handleRecover = () => withLoading(async () => {
    const token = code.replace(/\s/g, '');
    if (token.length < 6) return setMessage({ text: 'Lütfen e-postanıza gelen kodu eksiksiz girin.', type: 'error' });
    if (password.length < 6) return setMessage({ text: 'Yeni şifre en az 6 karakter olmalıdır.', type: 'error' });
    const { error } = await auth.recover(pendingEmail, token, password);
    if (error) setMessage({ text: error, type: 'error' });
  });

  const [title, sub] = TITLES[view];
  const subtitle = view === 'verify' || view === 'recover'
    ? `${pendingEmail} adresine gönderilen kodu girin.`
    : sub;

  const codeField = (
    <Field
      icon="keypad-outline"
      placeholder="E-postadaki kod"
      value={code}
      onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 10))}
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      autoComplete="one-time-code"
    />
  );

  const resendButton = (
    <TouchableOpacity onPress={handleResend} disabled={cooldown > 0 || loading} style={styles.linkBtn}>
      <Text style={[styles.linkText, cooldown > 0 && { color: COLORS.textDark }]}>
        {cooldown > 0 ? `Tekrar gönder (${cooldown})` : 'Kodu tekrar gönder'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.card}>
      {(view === 'login' || view === 'register') && (
        <View style={styles.tabs}>
          {['login', 'register'].map(t => (
            <TouchableOpacity key={t} style={[styles.tab, view === t && styles.tabActive]} onPress={() => go(t)}>
              <Text style={[styles.tabText, view === t && styles.tabTextActive]}>
                {t === 'login' ? 'Giriş Yap' : 'Üye Ol'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

      {message && (
        <View style={[styles.message, styles[`message_${message.type}`]]}>
          <Text style={styles.messageText}>{message.text}</Text>
        </View>
      )}

      {view === 'login' && (
        <>
          <Field icon="mail-outline" placeholder="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" />
          <Field icon="lock-closed-outline" placeholder="Şifre" value={password} onChangeText={setPassword} secure textContentType="password" autoComplete="password" onSubmitEditing={handleLogin} />
          <TouchableOpacity onPress={() => go('forgot')} style={[styles.linkBtn, { alignSelf: 'flex-end' }]}>
            <Text style={styles.linkText}>Şifremi unuttum</Text>
          </TouchableOpacity>
          <PrimaryButton label="Giriş Yap" onPress={handleLogin} loading={loading} />
        </>
      )}

      {view === 'register' && (
        <>
          <Field icon="person-outline" placeholder="Ad Soyad" value={name} onChangeText={setName} autoCapitalize="words" textContentType="name" />
          <Field icon="mail-outline" placeholder="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" />
          <Field icon="lock-closed-outline" placeholder="Şifre (en az 6 karakter)" value={password} onChangeText={setPassword} secure textContentType="newPassword" />
          <Field icon="lock-closed-outline" placeholder="Şifre (tekrar)" value={password2} onChangeText={setPassword2} secure textContentType="newPassword" />
          <PrimaryButton label="Üye Ol" onPress={handleRegister} loading={loading} />
        </>
      )}

      {view === 'verify' && (
        <>
          {codeField}
          <PrimaryButton label="Doğrula" onPress={handleVerify} loading={loading} />
          {resendButton}
          <TouchableOpacity onPress={() => go('login')} style={styles.linkBtn}>
            <Text style={styles.linkText}>← Girişe dön</Text>
          </TouchableOpacity>
        </>
      )}

      {view === 'forgot' && (
        <>
          <Field icon="mail-outline" placeholder="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" />
          <PrimaryButton label="Sıfırlama Kodu Gönder" onPress={handleForgot} loading={loading} />
          <TouchableOpacity onPress={() => go('login')} style={styles.linkBtn}>
            <Text style={styles.linkText}>← Girişe dön</Text>
          </TouchableOpacity>
        </>
      )}

      {view === 'recover' && (
        <>
          {codeField}
          <Field icon="lock-closed-outline" placeholder="Yeni şifre (en az 6 karakter)" value={password} onChangeText={setPassword} secure textContentType="newPassword" />
          <PrimaryButton label="Şifreyi Güncelle" onPress={handleRecover} loading={loading} />
          {resendButton}
          <TouchableOpacity onPress={() => go('login')} style={styles.linkBtn}>
            <Text style={styles.linkText}>← Girişe dön</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

function Profile() {
  const { user, signOut } = useAuth();
  const { plannedCourses, syncStatus } = usePlan();
  const name = displayName(user);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toLocaleUpperCase('tr-TR') || '?';

  const syncText = {
    saving: ['⏳ Kaydediliyor...', COLORS.warning],
    saved: ['✅ Taslağın hesabına kaydedildi', COLORS.success],
    error: ['⚠️ Taslak kaydedilemedi, internet bağlantını kontrol et', COLORS.danger],
    loading: ['⏳ Hesaptaki taslak yükleniyor...', COLORS.warning],
  }[syncStatus] || ['✅ Taslağın hesabına kaydedildi', COLORS.success];

  const confirmSignOut = () => {
    Alert.alert('Çıkış Yap', 'Hesabından çıkış yapılsın mı? Taslağın bu cihazda kalmaya devam eder.', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <View style={styles.card}>
      <View style={styles.profileRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{name}</Text>
          <Text style={styles.subtitle}>{user.email}</Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <Ionicons name="bookmark-outline" size={16} color={COLORS.primaryLight} />
        <Text style={styles.infoText}>Taslakta {plannedCourses.length} ders var</Text>
      </View>
      <View style={styles.infoRow}>
        <Ionicons name="cloud-outline" size={16} color={syncText[1]} />
        <Text style={[styles.infoText, { color: syncText[1] }]}>{syncText[0]}</Text>
      </View>
      <Text style={styles.hint}>
        Aynı hesapla web sitesinde giriş yaptığında da aynı taslağı görürsün.
      </Text>

      <TouchableOpacity style={styles.logoutBtn} onPress={confirmSignOut}>
        <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
        <Text style={styles.logoutText}>Çıkış Yap</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AccountScreen() {
  const { user, ready } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.screenTitle}>Hesabım</Text>
            <Text style={styles.screenSubtitle}>Web sitesiyle aynı BTÜ Kampüs Asistanı hesabı</Text>
          </View>
          {!ready ? (
            <ActivityIndicator color={COLORS.primaryLight} style={{ marginTop: 40 }} />
          ) : user ? (
            <Profile />
          ) : (
            <AuthForms />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    paddingVertical: 12,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  screenSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    gap: 12,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 4,
  },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  linkBtn: {
    paddingVertical: 4,
    alignSelf: 'center',
  },
  linkText: {
    color: COLORS.primaryLight,
    fontSize: 13,
    fontWeight: '600',
  },
  message: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  message_error: {
    backgroundColor: COLORS.dangerBg,
    borderColor: COLORS.dangerBorder,
  },
  message_success: {
    backgroundColor: COLORS.successBg,
    borderColor: COLORS.successBorder,
  },
  message_info: {
    backgroundColor: COLORS.infoBg,
    borderColor: COLORS.infoBorder,
  },
  messageText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    color: COLORS.textDark,
    fontSize: 12,
    lineHeight: 17,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerBg,
    marginTop: 4,
  },
  logoutText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '800',
  },
});
