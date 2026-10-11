// ============================================================
// BTÜ Kampüs Asistanı – Üyelik / Giriş / E-posta Onay Kodu
// Supabase Auth (OTP) kullanır. Yapılandırma: supabase_config.js
// ============================================================
(function () {
  const cfg = window.SUPABASE_CONFIG || {};
  const isConfigured =
    !!cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("PROJE-ID") &&
    !!cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("BURAYA");

  const sb = (isConfigured && window.supabase)
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

  const RESEND_COOLDOWN = 60; // saniye
  let currentUser = null;
  let pendingEmail = "";
  let cooldownTimer = null;

  // ---------- Yardımcılar ----------
  const $ = (id) => document.getElementById(id);

  function translateError(err) {
    const msg = (err && (err.message || err.error_description || String(err))) || "";
    const m = msg.toLowerCase();
    if (m.includes("invalid login credentials")) return "E-posta veya şifre hatalı.";
    if (m.includes("email not confirmed")) return "E-posta adresiniz henüz doğrulanmamış.";
    if (m.includes("user already registered")) return "Bu e-posta adresi zaten kayıtlı.";
    if (m.includes("password should be at least")) return "Şifre en az 6 karakter olmalıdır.";
    if (m.includes("token has expired") || m.includes("otp_expired") || m.includes("invalid")) return "Kod hatalı veya süresi dolmuş. Yeni kod isteyebilirsiniz.";
    if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) return "Çok fazla deneme yapıldı. Lütfen biraz bekleyip tekrar deneyin.";
    if (m.includes("unable to validate email") || m.includes("invalid email")) return "Geçerli bir e-posta adresi girin.";
    if (m.includes("failed to fetch") || m.includes("network")) return "Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.";
    return msg || "Beklenmeyen bir hata oluştu.";
  }

  function setMessage(text, type = "error") {
    const box = $("auth-message");
    if (!text) { box.classList.add("hidden"); return; }
    const styles = {
      error: "bg-rose-950/50 border-rose-800/70 text-rose-200",
      success: "bg-emerald-950/50 border-emerald-800/70 text-emerald-200",
      info: "bg-blue-950/50 border-blue-800/70 text-blue-200"
    };
    box.className = `mb-4 p-3 rounded-xl border text-xs leading-relaxed ${styles[type] || styles.error}`;
    box.textContent = text;
  }

  function setLoading(btnId, loading, label) {
    const btn = $(btnId);
    if (!btn) return;
    if (loading) {
      btn.dataset.label = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin align-middle"></span>`;
    } else {
      btn.disabled = false;
      btn.innerHTML = label || btn.dataset.label || btn.innerHTML;
    }
  }

  function requireClient() {
    if (sb) return true;
    setMessage("Üyelik sistemi henüz yapılandırılmadı. supabase_config.js dosyasına Supabase URL ve anon key bilgilerini girin.", "info");
    return false;
  }

  // ---------- Modal / görünüm yönetimi ----------
  const VIEWS = ["login", "register", "verify", "forgot", "recover"];
  const TITLES = {
    login: ["Tekrar hoş geldin 👋", "Taslaklarına her cihazdan erişmek için giriş yap."],
    register: ["Hesap oluştur", "Ücretsiz üye ol, ders taslağın hesabına kaydedilsin."],
    verify: ["E-postanı doğrula", ""],
    forgot: ["Şifremi unuttum", "E-posta adresine bir sıfırlama kodu gönderelim."],
    recover: ["Yeni şifre belirle", ""]
  };

  function showView(view) {
    VIEWS.forEach(v => $(`auth-view-${v}`).classList.toggle("hidden", v !== view));
    const [title, sub] = TITLES[view];
    $("auth-title").textContent = title;
    let subtitle = sub;
    if (view === "verify" || view === "recover") {
      subtitle = `${pendingEmail} adresine gönderilen doğrulama kodunu girin.`;
    }
    $("auth-subtitle").textContent = subtitle;
    $("auth-tabs").classList.toggle("hidden", !(view === "login" || view === "register"));
    ["login", "register"].forEach(t => {
      const active = t === view;
      $(`auth-tab-${t}`).className = `flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${active ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"}`;
    });
    setMessage("");
    setTimeout(() => {
      const first = $(`auth-view-${view}`).querySelector("input");
      if (first) first.focus();
    }, 50);
  }

  function open(view = "login") {
    $("auth-modal").classList.remove("hidden");
    requestAnimationFrame(() => $("auth-modal").classList.add("auth-open"));
    showView(view);
    if (!sb) requireClient();
  }

  function close() {
    $("auth-modal").classList.remove("auth-open");
    setTimeout(() => $("auth-modal").classList.add("hidden"), 200);
  }

  function startCooldown(btnId) {
    const btn = $(btnId);
    if (!btn) return;
    let left = RESEND_COOLDOWN;
    clearInterval(cooldownTimer);
    btn.disabled = true;
    btn.textContent = `Tekrar gönder (${left})`;
    cooldownTimer = setInterval(() => {
      left--;
      if (left <= 0) {
        clearInterval(cooldownTimer);
        btn.disabled = false;
        btn.textContent = "Kodu tekrar gönder";
      } else {
        btn.textContent = `Tekrar gönder (${left})`;
      }
    }, 1000);
  }

  function goVerify(email, notice) {
    pendingEmail = email;
    $("verify-code").value = "";
    showView("verify");
    if (notice) setMessage(notice, "info");
    startCooldown("verify-resend");
  }

  // ---------- İşlemler ----------
  async function handleLogin(e) {
    e.preventDefault();
    if (!requireClient()) return;
    const email = $("login-email").value.trim();
    const password = $("login-password").value;
    setLoading("login-submit", true);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setLoading("login-submit", false);
    if (error) {
      if ((error.message || "").toLowerCase().includes("email not confirmed")) {
        await sb.auth.resend({ type: "signup", email });
        goVerify(email, "E-postanız henüz doğrulanmamış. Yeni bir onay kodu gönderdik.");
        return;
      }
      setMessage(translateError(error));
      return;
    }
    close();
    toast("Giriş başarılı. Hoş geldin! 🎉");
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!requireClient()) return;
    const name = $("register-name").value.trim();
    const email = $("register-email").value.trim();
    const password = $("register-password").value;
    const password2 = $("register-password2").value;

    if (password.length < 6) return setMessage("Şifre en az 6 karakter olmalıdır.");
    if (password !== password2) return setMessage("Şifreler birbiriyle eşleşmiyor.");

    setLoading("register-submit", true);
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    });
    setLoading("register-submit", false);

    if (error) return setMessage(translateError(error));

    // Supabase, kayıtlı ve doğrulanmış e-postalar için boş identities döndürür
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return setMessage("Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.");
    }
    // E-posta doğrulaması kapalıysa oturum doğrudan açılır
    if (data.session) {
      close();
      toast("Hesabın oluşturuldu. Hoş geldin! 🎉");
      return;
    }
    goVerify(email, "Onay kodu e-posta adresine gönderildi. Gelen kutunu (ve spam klasörünü) kontrol et.");
  }

  async function handleVerify(e) {
    e.preventDefault();
    if (!requireClient()) return;
    const token = $("verify-code").value.replace(/\s/g, "");
    if (token.length < 6) return setMessage("Lütfen e-postanıza gelen kodu eksiksiz girin.");
    setLoading("verify-submit", true);
    const { error } = await sb.auth.verifyOtp({ email: pendingEmail, token, type: "signup" });
    setLoading("verify-submit", false);
    if (error) return setMessage(translateError(error));
    close();
    toast("E-posta doğrulandı, hesabın aktif! 🎉");
  }

  async function handleResend() {
    if (!requireClient() || !pendingEmail) return;
    const { error } = await sb.auth.resend({ type: "signup", email: pendingEmail });
    if (error) return setMessage(translateError(error));
    setMessage("Yeni onay kodu gönderildi.", "success");
    startCooldown("verify-resend");
  }

  async function handleForgot(e) {
    e.preventDefault();
    if (!requireClient()) return;
    const email = $("forgot-email").value.trim();
    setLoading("forgot-submit", true);
    const { error } = await sb.auth.resetPasswordForEmail(email);
    setLoading("forgot-submit", false);
    if (error) return setMessage(translateError(error));
    pendingEmail = email;
    $("recover-code").value = "";
    $("recover-password").value = "";
    showView("recover");
    setMessage("Şifre sıfırlama kodu e-posta adresine gönderildi.", "info");
    startCooldown("recover-resend");
  }

  async function handleRecoverResend() {
    if (!requireClient() || !pendingEmail) return;
    const { error } = await sb.auth.resetPasswordForEmail(pendingEmail);
    if (error) return setMessage(translateError(error));
    setMessage("Yeni sıfırlama kodu gönderildi.", "success");
    startCooldown("recover-resend");
  }

  async function handleRecover(e) {
    e.preventDefault();
    if (!requireClient()) return;
    const token = $("recover-code").value.replace(/\s/g, "");
    const password = $("recover-password").value;
    if (token.length < 6) return setMessage("Lütfen e-postanıza gelen kodu eksiksiz girin.");
    if (password.length < 6) return setMessage("Yeni şifre en az 6 karakter olmalıdır.");
    setLoading("recover-submit", true);
    const { error } = await sb.auth.verifyOtp({ email: pendingEmail, token, type: "recovery" });
    if (error) { setLoading("recover-submit", false); return setMessage(translateError(error)); }
    const { error: upErr } = await sb.auth.updateUser({ password });
    setLoading("recover-submit", false);
    if (upErr) return setMessage(translateError(upErr));
    close();
    toast("Şifren güncellendi ve giriş yapıldı. 🔐");
  }

  async function logout() {
    if (!sb) return;
    await sb.auth.signOut();
    $("user-menu").classList.add("hidden");
    toast("Çıkış yapıldı.");
  }

  // ---------- Üst menü (header) ----------
  function displayName(user) {
    return (user?.user_metadata?.full_name || "").trim() || (user?.email || "").split("@")[0];
  }

  function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toLocaleUpperCase("tr-TR") || "?";
  }

  function renderHeader() {
    const loginBtn = $("auth-login-btn");
    const userBtn = $("auth-user-btn");
    if (currentUser) {
      const name = displayName(currentUser);
      loginBtn.classList.add("hidden");
      userBtn.classList.remove("hidden");
      $("auth-avatar").textContent = initials(name);
      $("auth-user-name").textContent = name;
      $("user-menu-name").textContent = name;
      $("user-menu-email").textContent = currentUser.email;
    } else {
      loginBtn.classList.remove("hidden");
      userBtn.classList.add("hidden");
      $("user-menu").classList.add("hidden");
    }
  }

  // ---------- Toast bildirimi ----------
  function toast(text) {
    const t = $("toast");
    t.textContent = text;
    t.classList.remove("opacity-0", "translate-y-4", "pointer-events-none");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add("opacity-0", "translate-y-4", "pointer-events-none"), 3000);
  }

  // ---------- Ders taslağı senkronizasyonu ----------
  async function loadPlan() {
    if (!sb || !currentUser) return null;
    const { data, error } = await sb.from("user_plans").select("courses").eq("user_id", currentUser.id).maybeSingle();
    if (error) { console.warn("Taslak yüklenemedi:", error); return null; }
    return data ? data.courses : [];
  }

  let saveTimer = null;
  function savePlan(courses) {
    if (!sb || !currentUser) return;
    clearTimeout(saveTimer);
    setSyncStatus("saving");
    saveTimer = setTimeout(async () => {
      const { error } = await sb.from("user_plans").upsert({
        user_id: currentUser.id,
        courses,
        updated_at: new Date().toISOString()
      });
      if (error) { console.warn("Taslak kaydedilemedi:", error); setSyncStatus("error"); }
      else setSyncStatus("saved");
    }, 600);
  }

  function setSyncStatus(state) {
    const el = $("planner-sync");
    if (!el) return;
    const map = {
      guest: ["☁️ Giriş yaparak taslağını hesabına kaydet", "text-slate-400 hover:text-blue-300 cursor-pointer"],
      saving: ["⏳ Kaydediliyor...", "text-amber-300"],
      saved: ["✅ Hesabına kaydedildi", "text-emerald-300"],
      error: ["⚠️ Kaydedilemedi", "text-rose-300"]
    };
    const [text, cls] = map[state] || map.guest;
    el.textContent = text;
    el.className = `text-[11px] font-medium transition-colors ${cls}`;
    el.onclick = state === "guest" ? () => open("login") : null;
  }

  // ---------- Başlatma ----------
  function bind() {
    $("auth-login-btn").onclick = () => open("login");
    $("auth-close").onclick = close;
    $("auth-backdrop").onclick = close;
    $("auth-tab-login").onclick = () => showView("login");
    $("auth-tab-register").onclick = () => showView("register");
    $("auth-form-login").onsubmit = handleLogin;
    $("auth-form-register").onsubmit = handleRegister;
    $("auth-form-verify").onsubmit = handleVerify;
    $("auth-form-forgot").onsubmit = handleForgot;
    $("auth-form-recover").onsubmit = handleRecover;
    $("verify-resend").onclick = handleResend;
    $("recover-resend").onclick = handleRecoverResend;
    $("goto-forgot").onclick = () => { $("forgot-email").value = $("login-email").value; showView("forgot"); };
    document.querySelectorAll("[data-auth-back]").forEach(b => b.onclick = () => showView("login"));
    $("auth-user-btn").onclick = (e) => { e.stopPropagation(); $("user-menu").classList.toggle("hidden"); };
    $("auth-logout").onclick = logout;
    document.addEventListener("click", (e) => {
      if (!$("user-menu").contains(e.target)) $("user-menu").classList.add("hidden");
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    document.querySelectorAll("[data-toggle-pass]").forEach(btn => {
      btn.onclick = () => {
        const input = $(btn.dataset.togglePass);
        input.type = input.type === "password" ? "text" : "password";
        btn.textContent = input.type === "password" ? "👁️" : "🙈";
      };
    });
    ["verify-code", "recover-code"].forEach(id => {
      $(id).addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10); });
    });
  }

  function init() {
    bind();
    renderHeader();
    setSyncStatus("guest");
    if (!sb) return;

    sb.auth.onAuthStateChange((event, session) => {
      const prevId = currentUser?.id;
      currentUser = session?.user || null;
      renderHeader();
      setSyncStatus(currentUser ? "saved" : "guest");
      if (prevId !== currentUser?.id) {
        // Supabase callback'i içinde başka auth çağrısı yapmamak için bir sonraki tick'e ertele
        setTimeout(() => window.dispatchEvent(new CustomEvent("btu-auth", { detail: { user: currentUser } })), 0);
      }
    });
  }

  window.Auth = {
    open, close, logout, loadPlan, savePlan, toast,
    getUser: () => currentUser,
    isConfigured: () => !!sb
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
