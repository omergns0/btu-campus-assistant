// ============================================================
// BTÜ Kampüs Asistanı - Google Gemini Destekli Yapay Zeka Asistanı
// ============================================================

(function () {
  const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
  let chatHistory = [];
  let isGenerating = false;

  function cleanStr(str) {
    if (!str) return "";
    return str.trim().toLowerCase()
      .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
      .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c");
  }

  function getTodayTurkish() {
    const dayIdx = new Date().getDay();
    if (dayIdx >= 1 && dayIdx <= 5) return DAYS[dayIdx - 1];
    return "Pazartesi";
  }

  function getTomorrowTurkish() {
    const dayIdx = new Date().getDay();
    if (dayIdx >= 1 && dayIdx <= 4) return DAYS[dayIdx];
    return "Pazartesi";
  }

  // --- RAG (AKILLI BİLGİ AYIKLAMA MOTORU) ---
  function extractRelevantContext(query) {
    const qNorm = cleanStr(query);
    const rawPrograms = (typeof ALL_PROGRAMS_DATA !== "undefined") ? ALL_PROGRAMS_DATA : {};
    const rawClassrooms = (typeof CLASSROOMS_DATA !== "undefined") ? CLASSROOMS_DATA : {};

    let contextParts = [];

    // 1. Gün Algılama
    let targetDay = null;
    if (qNorm.includes("bugun")) targetDay = getTodayTurkish();
    else if (qNorm.includes("yarin")) targetDay = getTomorrowTurkish();
    else {
      DAYS.forEach(d => {
        if (qNorm.includes(cleanStr(d))) targetDay = d;
      });
    }

    // 2. Bölüm / Program Arama
    const matchedPrograms = [];
    Object.entries(rawPrograms).forEach(([pKey, pVal]) => {
      const pNorm = cleanStr(pKey);
      const titleNorm = cleanStr(pVal.title || "");
      const deptNorm = cleanStr(pVal.department || "");

      // Sorgudaki anahtar kelimelerle eşleştir
      const words = qNorm.split(/\s+/).filter(w => w.length > 3);
      const matches = words.filter(w => pNorm.includes(w) || titleNorm.includes(w) || deptNorm.includes(w));
      if (matches.length > 0) {
        matchedPrograms.push({ key: pKey, data: pVal, score: matches.length });
      }
    });

    matchedPrograms.sort((a, b) => b.score - a.score);

    // Eğer belirli bir bölüm sorulmuşsa derslerini ekle
    if (matchedPrograms.length > 0) {
      const topProg = matchedPrograms[0].data;
      let courses = topProg.courses || [];
      if (targetDay) {
        courses = courses.filter(c => cleanStr(c.day) === cleanStr(targetDay));
      }
      const courseSummary = courses.slice(0, 15).map(c => 
        `- [${c.day} ${String(c.hour).padStart(2, '0')}:00] ${c.code || ''} ${c.name} (${c.section || 'Şube 1'}) | Derslik: ${c.classroom || 'Belirtilmemiş'} | Hoca: ${c.instructor || 'Belirtilmemiş'}`
      ).join("\n");

      contextParts.push(`[${topProg.title || matchedPrograms[0].key} DERS PROGRAMI ${targetDay ? '(' + targetDay + ')' : ''}]:\n${courseSummary || 'Bu kriterde ders bulunamadı.'}`);
    }

    // 3. Hoca Arama
    let instructorHits = [];
    Object.values(rawPrograms).forEach(prog => {
      (prog.courses || []).forEach(c => {
        if (c.instructor && cleanStr(c.instructor).length > 3) {
          const instNorm = cleanStr(c.instructor);
          const qWords = qNorm.split(/\s+/).filter(w => w.length > 3);
          if (qWords.some(w => instNorm.includes(w))) {
            instructorHits.push({
              instructor: c.instructor,
              day: c.day,
              hour: c.hour,
              code: c.code,
              name: c.name,
              room: c.classroom,
              prog: prog.title
            });
          }
        }
      });
    });

    if (instructorHits.length > 0) {
      const grouped = {};
      instructorHits.forEach(h => {
        if (!grouped[h.instructor]) grouped[h.instructor] = [];
        grouped[h.instructor].push(`- ${h.day} ${h.hour}:00: ${h.code || ''} ${h.name} (${h.room || '-'})`);
      });

      Object.entries(grouped).slice(0, 3).forEach(([instName, slots]) => {
        contextParts.push(`[HOCA: ${instName}]:\n${slots.slice(0, 8).join("\n")}`);
      });
    }

    // 4. Boş Derslik / Sınıf Arama
    if (qNorm.includes("bos") || qNorm.includes("sinif") || qNorm.includes("derslik") || qNorm.includes("amfi") || qNorm.includes("oda")) {
      const curHour = new Date().getHours();
      const checkHour = (curHour >= 8 && curHour < 17) ? curHour : 13;
      const dayForRooms = targetDay || getTodayTurkish();
      const normD = cleanStr(dayForRooms);

      let emptyRooms = [];
      Object.entries(rawClassrooms).forEach(([room, sched]) => {
        const hasConflict = sched.some(s => {
          if (cleanStr(s.day) !== normD) return false;
          let h = s.hour !== undefined ? parseInt(s.hour, 10) : (s.start ? parseInt(s.start, 10) : -1);
          return h === checkHour;
        });
        if (!hasConflict) emptyRooms.push(room);
      });

      contextParts.push(`[${dayForRooms} günü saat ${checkHour}:00 itibariyle boş dersliklerden bazıları (Toplam ${emptyRooms.length} boş sınıf)]:\n${emptyRooms.slice(0, 15).join(", ")}`);
    }

    // 5. Sınav Takvimi ve Duyuruları Arama
    if (qNorm.includes("sinav") || qNorm.includes("vize") || qNorm.includes("final") || qNorm.includes("butunleme") || qNorm.includes("takvim")) {
      const rawExams = (typeof EXAM_DATA !== "undefined" && EXAM_DATA && EXAM_DATA.departments) ? EXAM_DATA.departments : {};
      let examHits = [];
      const words = qNorm.split(/\s+/).filter(w => w.length > 3);
      Object.entries(rawExams).forEach(([k, d]) => {
        if (k === "_genel") return;
        const nameNorm = cleanStr(d.name || "");
        const facNorm = cleanStr(d.faculty || "");
        const matches = words.filter(w => nameNorm.includes(w) || facNorm.includes(w));
        if (matches.length > 0) {
          examHits.push({ dept: d, score: matches.length });
        }
      });

      examHits.sort((a, b) => b.score - a.score);
      const targetDepts = examHits.length > 0 
        ? examHits.slice(0, 5).map(h => h.dept) 
        : Object.values(rawExams).filter(d => d.has_announcement).slice(0, 6);

      if (targetDepts.length > 0) {
        const examSummary = targetDepts.map(d => {
          if (d.has_announcement && d.announcements && d.announcements.length > 0) {
            const a = d.announcements[0];
            return `- ${d.name}: [YAYINDA] "${a.title}" (Tarih: ${a.date}) Duyuru: ${a.url}`;
          } else {
            return `- ${d.name}: [HENÜZ DUYURULMADI] Resmi sitede henüz yayınlanmadı.`;
          }
        }).join("\n");
        contextParts.push(`[GÜNCEL BTÜ SINAV TAKVİMİ DURUMU]:\n${examSummary}`);
      }
    }

    return contextParts.join("\n\n");
  }

  // --- GEMINI API ÇAĞRISI ---
  async function queryGemini(userMessage, context) {
    const cfg = window.GEMINI_CONFIG || {};
    let apiKey = (cfg.GEMINI_API_KEY || "").trim();
    if (typeof localStorage !== "undefined") {
      const customKey = localStorage.getItem("btu_gemini_api_key");
      if (customKey && customKey.trim()) apiKey = customKey.trim();
    }
    const isConfigured = !!apiKey && !apiKey.includes("BURAYA");

    // Sistem yönergesi (Prompt)
    const systemInstruction = `Sen Bursa Teknik Üniversitesi (BTÜ) öğrencileri için geliştirilmiş resmi BTÜ Kampüs Asistanı yapay zekasısın.
Öğrencilerin ders programları, boş sınıflar, hocalar, derslikler ve üniversite yaşamıyla ilgili sorularına Türkçe, çok samimi, net, düzenli ve motive edici bir dille cevap veriyorsun.

Önemli Kurallar:
1. Sana verilen veritabanı bağlamına (context) sıkı sıkıya sadık kal. Eğer bağlamda aranan bilgi yoksa uydurma, kibarca o dersin veya hocanın sistemde henüz yer almadığını belirt.
2. Saatleri, günleri, bina bloklarını (Mimar Sinan, Yıldırım Bayezid, E Blok vb.) ve derslik kodlarını net belirt.
3. Cevaplarını kalın harfler, madde işaretleri (bullet points) ve emojilerle zenginleştir, kolay okunabilir yap.`;

    const promptText = `Aşağıdaki BTÜ veri tabanı bağlamını kullanarak kullanıcının sorusuna cevap ver.

${context ? '--- BTÜ VERİ TABANI BİLGİSİ ---\n' + context + '\n---' : 'İlgili veri tabanı kaydı bulunamadı.'}

Kullanıcı Sorusu: ${userMessage}`;

    if (!isConfigured) {
      // API Key henüz girilmemişse zeki yerel yanıt oluştur
      return generateSmartFallback(userMessage, context);
    }

    const modelName = cfg.MODEL || "gemini-flash-latest";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: systemInstruction + "\n\n" + promptText }]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 800
      }
    };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        console.warn("[Gemini API Hatası]:", errJson);
        return generateSmartFallback(userMessage, context, "Gemini API kotası veya anahtar hatası nedeniyle yerel asistan yanıtı üretildi.");
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return text || "Üzgünüm, şu anda bu soruya yanıt oluşturamadım.";
    } catch (e) {
      console.warn("[Gemini Ağ Hatası]:", e);
      return generateSmartFallback(userMessage, context, "İnternet bağlantısı nedeniyle yerel asistan yanıtı üretildi.");
    }
  }

  // Akıllı Yerel Yedek Yanıtlayıcı (API Key olmadan da çalışır)
  function generateSmartFallback(userMessage, context, notice) {
    if (!context || context.trim().length === 0) {
      return `Merhaba! Sorunuzu inceledim ancak sistemde doğrudan eşleşen bir ders, sınıf veya hoca kaydı bulamadım. 🔍\n\nLütfen bölüm adını (örn: *Bilgisayar Mühendisliği 2. Sınıf*), hoca adını veya ders kodunu biraz daha detaylı belirtmeyi deneyin.`;
    }

    let response = `İşte sistemdeki kayıtlar doğrultusunda bulduğum bilgiler: 📋\n\n`;

    const lines = context.split("\n");
    lines.forEach(l => {
      if (l.startsWith("[")) response += `**${l.replace(/[\[\]]/g, "")}**\n`;
      else if (l.startsWith("-")) response += `• ${l.substring(1).trim()}\n`;
      else response += `${l}\n`;
    });

    if (notice) {
      response += `\n\n*(Not: ${notice})*`;
    } else {
      response += `\n\n💡 *Doğal sohbet deneyimi için \`gemini_config.js\` dosyasına ücretsiz Google Gemini API anahtarınızı tanımlayabilirsiniz.*`;
    }

    return response;
  }

  // --- MARKDOWN FORMATLAYICI ---
  function formatMarkdown(text) {
    if (!text) return "";
    let safe = text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Bold
    safe = safe.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    // Italic
    safe = safe.replace(/\*(.*?)\*/g, "<em>$1</em>");
    // Code
    safe = safe.replace(/`([^`]+)`/g, "<code class='bg-slate-800 px-1 py-0.5 rounded text-blue-300 font-mono text-[11px]'>$1</code>");
    // Bullet points
    safe = safe.replace(/^[•\-\*]\s+(.*)$/gm, "<li class='ml-4 list-disc'>$1</li>");
    // Line breaks
    safe = safe.replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>");

    return safe;
  }

  // --- ARAYÜZ (CHAT UI) ---
  function initChatUI() {
    // 1. Sağ Altta Kayan Buton (Floating Button)
    const floatBtn = document.createElement("button");
    floatBtn.id = "btn-ai-toggle";
    floatBtn.className = "fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-semibold text-xs shadow-2xl shadow-blue-600/40 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 border border-white/20";
    floatBtn.innerHTML = `
      <span class="text-base animate-pulse">🤖</span>
      <span class="hidden sm:inline">BTÜ AI Asistan</span>
      <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
    `;
    document.body.appendChild(floatBtn);

    // 2. Sohbet Penceresi (Drawer / Modal)
    const chatModal = document.createElement("div");
    chatModal.id = "ai-chat-window";
    chatModal.className = "hidden fixed sm:bottom-20 bottom-16 sm:right-5 right-3 z-50 sm:w-[400px] w-[calc(100vw-24px)] h-[580px] max-h-[calc(100vh-90px)] bg-slate-900/95 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl fade-up";
    chatModal.innerHTML = `
      <!-- Başlık -->
      <div class="p-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-lg text-white font-bold shadow-md shadow-blue-500/20">
            🤖
          </div>
          <div>
            <h3 class="text-xs font-bold text-white leading-tight flex items-center gap-1.5">
              <span>BTÜ Kampüs AI</span>
              <span class="text-[9px] px-1.5 py-0.2 rounded bg-violet-950 text-violet-300 border border-violet-800/60 font-normal">Gemini</span>
            </h3>
            <p class="text-[10px] text-slate-400">Ders, sınıf ve hoca danışmanı</p>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <button id="ai-btn-key" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-xs" title="API Anahtarı Ayarları">🔑</button>
          <button id="ai-btn-clear" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-xs" title="Sohbeti Temizle">🗑️</button>
          <button id="ai-btn-close" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-xs" title="Kapat">✕</button>
        </div>
      </div>

      <!-- Mesaj Listesi -->
      <div id="ai-messages" class="flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar text-xs">
        <div class="flex items-start gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-blue-600/30 text-blue-300 border border-blue-500/30 flex items-center justify-center shrink-0 text-xs font-bold">AI</div>
          <div class="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/70 text-slate-200 leading-relaxed max-w-[85%]">
            Merhaba! Ben BTÜ Kampüs Asistanı yapay zekasıyım. 👋<br><br>
            Bana ders programınız, o anki boş derslikler veya hocalarınızla ilgili dilediğiniz soruyu sorabilirsiniz!
          </div>
        </div>

        <!-- Hızlı Öneri Butonları -->
        <div id="ai-quick-prompts" class="pt-2 flex flex-wrap gap-1.5">
          <button class="ai-chip px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 transition-all text-left">
            🏢 Şu an hangi sınıflar boş?
          </button>
          <button class="ai-chip px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 transition-all text-left">
            📅 Bilgisayar Müh. 1. sınıf bugünkü dersler
          </button>
          <button class="ai-chip px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 transition-all text-left">
            👨‍🏫 Ali İhsan Hoca'nın dersleri ne zaman?
          </button>
        </div>
      </div>

      <!-- Yazma Çubuğu -->
      <form id="ai-form" class="p-2.5 bg-slate-950/80 border-t border-slate-800 flex items-center gap-2 shrink-0">
        <input type="text" id="ai-input" placeholder="Ders, sınıf veya hoca hakkında sor..." class="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" autocomplete="off">
        <button type="submit" id="ai-submit" class="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-md shadow-blue-600/30 shrink-0">
          ➤
        </button>
      </form>
    `;
    document.body.appendChild(chatModal);

    // Olay Dinleyicileri
    function toggleChat() {
      chatModal.classList.toggle("hidden");
      if (!chatModal.classList.contains("hidden")) {
        const input = document.getElementById("ai-input");
        if (input) input.focus();
      }
    }
    window.toggleAIChat = toggleChat;
    window.openAIChat = () => {
      chatModal.classList.remove("hidden");
      const input = document.getElementById("ai-input");
      if (input) input.focus();
    };

    floatBtn.addEventListener("click", toggleChat);

    document.getElementById("ai-btn-close").addEventListener("click", () => {
      chatModal.classList.add("hidden");
    });

    const keyBtn = document.getElementById("ai-btn-key");
    if (keyBtn) {
      keyBtn.addEventListener("click", () => {
        const cur = (typeof localStorage !== "undefined" && localStorage.getItem("btu_gemini_api_key")) || "";
        const entered = prompt("Google Gemini API Anahtarınızı güncelleyin (Boş bırakırsanız sistemin varsayılan anahtarı kullanılır):", cur);
        if (entered !== null) {
          if (entered.trim()) {
            localStorage.setItem("btu_gemini_api_key", entered.trim());
            alert("✅ Gemini API anahtarınız bu tarayıcıya başarıyla kaydedildi!");
          } else {
            localStorage.removeItem("btu_gemini_api_key");
            alert("Varsayılan sistem anahtarına dönüldü.");
          }
        }
      });
    }

    document.getElementById("ai-btn-clear").addEventListener("click", () => {
      const msgBox = document.getElementById("ai-messages");
      msgBox.innerHTML = `
        <div class="flex items-start gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-blue-600/30 text-blue-300 border border-blue-500/30 flex items-center justify-center shrink-0 text-xs font-bold">AI</div>
          <div class="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/70 text-slate-200 leading-relaxed max-w-[85%]">
            Sohbet temizlendi. Yeni bir soru sorabilirsiniz! 🚀
          </div>
        </div>
      `;
    });

    // Hızlı çipler
    document.querySelectorAll(".ai-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const text = chip.innerText.replace(/^[^\s]+\s+/, "");
        document.getElementById("ai-input").value = text;
        sendMessage(text);
      });
    });

    // Form Gönderme
    document.getElementById("ai-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("ai-input");
      const val = input.value.trim();
      if (!val || isGenerating) return;
      input.value = "";
      sendMessage(val);
    });
  }

  function appendMessage(sender, text) {
    const msgBox = document.getElementById("ai-messages");
    const isUser = sender === "user";

    const msgRow = document.createElement("div");
    msgRow.className = `flex items-start gap-2.5 ${isUser ? 'justify-end' : ''} fade-up`;

    if (!isUser) {
      msgRow.innerHTML = `
        <div class="w-7 h-7 rounded-lg bg-blue-600/30 text-blue-300 border border-blue-500/30 flex items-center justify-center shrink-0 text-xs font-bold">AI</div>
        <div class="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/70 text-slate-200 leading-relaxed max-w-[85%]">
          ${formatMarkdown(text)}
        </div>
      `;
    } else {
      msgRow.innerHTML = `
        <div class="p-3 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 text-white leading-relaxed max-w-[85%] shadow-md">
          ${escapeHtml(text)}
        </div>
        <div class="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center shrink-0 text-xs font-bold">Sen</div>
      `;
    }

    msgBox.appendChild(msgRow);
    msgBox.scrollTop = msgBox.scrollHeight;
    return msgRow;
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  async function sendMessage(text) {
    isGenerating = true;
    appendMessage("user", text);

    // Hızlı önerileri gizle
    const quicks = document.getElementById("ai-quick-prompts");
    if (quicks) quicks.style.display = "none";

    // Yazıyor göstergesi
    const msgBox = document.getElementById("ai-messages");
    const typingIndicator = document.createElement("div");
    typingIndicator.id = "ai-typing";
    typingIndicator.className = "flex items-center gap-2 text-slate-400 text-xs p-2";
    typingIndicator.innerHTML = `
      <div class="w-7 h-7 rounded-lg bg-blue-600/30 text-blue-300 border border-blue-500/30 flex items-center justify-center shrink-0 text-xs font-bold">AI</div>
      <div class="flex items-center gap-1 bg-slate-800/60 px-3 py-2 rounded-xl border border-slate-700">
        <span class="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></span>
        <span class="text-[11px] text-slate-300">BTÜ verileri taranıyor & yanıt hazırlanıyor...</span>
      </div>
    `;
    msgBox.appendChild(typingIndicator);
    msgBox.scrollTop = msgBox.scrollHeight;

    // RAG: İlgili ders, sınıf ve hoca bağlamını çıkar
    const context = extractRelevantContext(text);

    // Gemini API'ye sor
    const reply = await queryGemini(text, context);

    if (typingIndicator.parentNode) {
      typingIndicator.parentNode.removeChild(typingIndicator);
    }

    appendMessage("ai", reply);
    isGenerating = false;
  }

  // Başlatıcı
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initChatUI);
  } else {
    initChatUI();
  }
})();
