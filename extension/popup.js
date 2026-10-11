// ============================================================
// BTÜ Kampüs Asistanı - Chrome Eklentisi Popup Mantığı
// ============================================================

(function () {
  const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
  const rawClassrooms = (typeof CLASSROOMS_DATA !== "undefined") ? CLASSROOMS_DATA : {};
  const rawPrograms = (typeof ALL_PROGRAMS_DATA !== "undefined") ? ALL_PROGRAMS_DATA : {};

  // Depolama Yardımcısı (Chrome Storage veya localStorage)
  const Storage = {
    get: function (key, callback) {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([key], res => callback(res ? res[key] : null));
      } else {
        try {
          const val = localStorage.getItem(key);
          callback(val ? JSON.parse(val) : null);
        } catch { callback(null); }
      }
    },
    set: function (key, val) {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        const obj = {}; obj[key] = val;
        chrome.storage.local.set(obj);
      } else {
        try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
      }
    }
  };

  function cleanStr(str) {
    if (!str) return "";
    return str.trim().toLowerCase()
      .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
      .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c");
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function getTodayTurkish() {
    const dayIdx = new Date().getDay(); // 0 Pazar, 1 Pzt ...
    if (dayIdx >= 1 && dayIdx <= 5) return DAYS[dayIdx - 1];
    return "Pazartesi";
  }

  // --- SEKME YÖNETİMİ ---
  function initTabs() {
    const tabBtns = document.querySelectorAll(".tab-btn");
    tabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.tab;
        switchTab(target);
      });
    });

    Storage.get("btu_last_tab", lastTab => {
      if (lastTab && document.getElementById(`section-${lastTab}`)) {
        switchTab(lastTab);
      }
    });
  }

  function switchTab(target) {
    document.querySelectorAll(".tab-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.tab === target);
    });
    document.querySelectorAll(".tab-section").forEach(sec => {
      sec.classList.toggle("active", sec.id === `section-${target}`);
    });
    Storage.set("btu_last_tab", target);
  }

  // ============================================================
  // 1. BOŞ DERSLİK BULUCU
  // ============================================================
  let selectedEmptyDay = getTodayTurkish();
  let emptyFilterState = "EMPTY"; // "EMPTY" veya "ALL"

  function getCampus(room) {
    const r = (room || "").toUpperCase();
    if (r.includes("YILDIRIM") || r.includes("YB /") || r.includes("YB-") || r.includes("YB/")) return "YB";
    return "MS";
  }

  function getBlock(room) {
    const r = (room || "").toUpperCase();
    if (r.includes("A BLOK") || r.startsWith("A/")) return "A Blok";
    if (r.includes("B BLOK") || r.startsWith("B/")) return "B Blok";
    if (r.includes("C BLOK") || r.startsWith("C/")) return "C Blok";
    if (r.includes("D BLOK") || r.startsWith("D/")) return "D Blok";
    if (r.includes("E BLOK") || r.startsWith("E/")) return "E Blok";
    if (r.includes("F BLOK") || r.startsWith("F/")) return "F Blok";
    if (r.includes("G BLOK") || r.startsWith("G/")) return "G Blok";
    if (r.includes("AMFİ") || r.includes("AMFI")) return "Amfiler";
    if (r.includes("LAB")) return "Laboratuvarlar";
    return "Diğer";
  }

  function initEmptyRooms() {
    // Gün butonları
    const dayContainer = document.getElementById("empty-day-buttons");
    const dayBtns = dayContainer.querySelectorAll(".chip-btn");
    dayBtns.forEach(btn => {
      if (btn.dataset.day === selectedEmptyDay) btn.classList.add("active");
      btn.addEventListener("click", () => {
        dayBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        selectedEmptyDay = btn.dataset.day;
        renderEmptyRooms();
      });
    });

    // Otomatik o anki saat seçimi
    const currentHour = new Date().getHours();
    if (currentHour >= 8 && currentHour < 17) {
      const startSel = document.getElementById("empty-start-time");
      const endSel = document.getElementById("empty-end-time");
      if (startSel) startSel.value = String(currentHour);
      if (endSel) endSel.value = String(Math.min(17, currentHour + 1));
    }

    // Blok seçeneklerini doldur
    const blockSelect = document.getElementById("empty-block");
    const foundBlocks = new Set();
    Object.keys(rawClassrooms).forEach(room => foundBlocks.add(getBlock(room)));
    Array.from(foundBlocks).sort().forEach(b => {
      blockSelect.innerHTML += `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`;
    });

    // Event listenerlar
    document.getElementById("empty-start-time").addEventListener("change", renderEmptyRooms);
    document.getElementById("empty-end-time").addEventListener("change", renderEmptyRooms);
    document.getElementById("empty-campus").addEventListener("change", renderEmptyRooms);
    document.getElementById("empty-block").addEventListener("change", renderEmptyRooms);
    document.getElementById("empty-search").addEventListener("input", renderEmptyRooms);

    const btnEmpty = document.getElementById("btn-filter-empty");
    const btnAll = document.getElementById("btn-filter-all");
    btnEmpty.addEventListener("click", () => {
      emptyFilterState = "EMPTY";
      btnEmpty.classList.add("active");
      btnAll.classList.remove("active");
      renderEmptyRooms();
    });
    btnAll.addEventListener("click", () => {
      emptyFilterState = "ALL";
      btnAll.classList.add("active");
      btnEmpty.classList.remove("active");
      renderEmptyRooms();
    });

    renderEmptyRooms();
  }

  function renderEmptyRooms() {
    const campusVal = document.getElementById("empty-campus").value;
    const blockVal = document.getElementById("empty-block").value;
    const startH = parseInt(document.getElementById("empty-start-time").value, 10);
    const endH = parseInt(document.getElementById("empty-end-time").value, 10);
    const searchVal = document.getElementById("empty-search").value.toLowerCase().trim();
    const resultsDiv = document.getElementById("empty-results");

    if (endH <= startH) {
      resultsDiv.innerHTML = `<div class="empty-state"><span class="emoji">⚠️</span>Bitiş saati başlangıç saatinden ileri olmalıdır.</div>`;
      document.getElementById("empty-stats").innerText = "Geçersiz aralık";
      return;
    }

    const roomNames = Object.keys(rawClassrooms).sort();
    let emptyCount = 0, totalCount = 0;
    let html = "";
    const normDay = cleanStr(selectedEmptyDay);

    roomNames.forEach(room => {
      const schedule = rawClassrooms[room] || [];
      const roomCampus = getCampus(room);
      const roomBlock = getBlock(room);

      if (campusVal !== "ALL" && roomCampus !== campusVal) return;
      if (blockVal !== "ALL" && roomBlock !== blockVal) return;
      if (searchVal && !room.toLowerCase().includes(searchVal)) return;

      totalCount++;

      const conflicts = schedule.filter(s => {
        if (cleanStr(s.day) !== normDay) return false;
        let h = -1;
        if (s.hour !== undefined) h = parseInt(s.hour, 10);
        else if (s.start) {
          const m = s.start.toString().match(/\d+/);
          if (m) h = parseInt(m[0], 10);
        }
        return h >= startH && h < endH;
      });

      const isFullyEmpty = conflicts.length === 0;
      if (isFullyEmpty) emptyCount++;

      if (emptyFilterState === "EMPTY" && !isFullyEmpty) return;

      const campusLabel = roomCampus === "MS" ? "M. Sinan" : "Yıldırım B.";

      html += `
        <div class="room-card ${isFullyEmpty ? 'is-empty' : 'is-busy'}">
          <div class="room-card-head">
            <span class="room-name">${escapeHtml(room)}</span>
            <span class="badge-status ${isFullyEmpty ? 'empty' : 'busy'}">
              ${isFullyEmpty ? 'BOŞ' : 'DOLU'}
            </span>
          </div>
          <div class="room-card-meta">
            <span class="tag campus">${campusLabel}</span>
            <span class="tag">${escapeHtml(roomBlock)}</span>
          </div>
          ${isFullyEmpty ? `
            <div class="room-card-desc">✓ Bu ${endH - startH} saat boyunca tamamen boş</div>
          ` : `
            <div class="room-card-busy-slots">
              ${conflicts.map(c => `<span class="slot-tag">${escapeHtml(c.start || c.hour + ':00')} dolu</span>`).join("")}
            </div>
          `}
        </div>
      `;
    });

    resultsDiv.innerHTML = html || `<div class="empty-state"><span class="emoji">🔍</span>Uygun derslik bulunamadı.</div>`;
    document.getElementById("empty-stats").innerText = `${emptyCount} Boş / ${totalCount} Sınıf`;
  }

  // ============================================================
  // 2. BÖLÜM DERS PROGRAMI
  // ============================================================
  let selectedTimetableDay = "TODAY";

  function initTimetable() {
    const progSelect = document.getElementById("tt-program-select");
    const progKeys = Object.keys(rawPrograms).sort();

    progSelect.innerHTML = `<option value="">Program Seçin (${progKeys.length} Program)</option>`;
    progKeys.forEach(k => {
      progSelect.innerHTML += `<option value="${escapeHtml(k)}">${escapeHtml(rawPrograms[k].title || k)}</option>`;
    });

    // Son seçilen bölümü hatırla
    Storage.get("btu_saved_program", saved => {
      if (saved && rawPrograms[saved]) {
        progSelect.value = saved;
        renderTimetable();
      }
    });

    progSelect.addEventListener("change", () => {
      Storage.set("btu_saved_program", progSelect.value);
      renderTimetable();
    });

    const dayBtns = document.getElementById("tt-day-buttons").querySelectorAll(".chip-btn");
    dayBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        dayBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        selectedTimetableDay = btn.dataset.day;
        renderTimetable();
      });
    });
  }

  function renderTimetable() {
    const progKey = document.getElementById("tt-program-select").value;
    const resultsDiv = document.getElementById("tt-results");

    if (!progKey || !rawPrograms[progKey]) {
      resultsDiv.innerHTML = `<div class="empty-state"><span class="emoji">🎓</span>Lütfen yukarıdan bölümünüzü seçin.</div>`;
      return;
    }

    const prog = rawPrograms[progKey];
    const courses = (prog.courses || []).slice().sort((a, b) => {
      const dayOrder = { "pazartesi": 1, "sali": 2, "carsamba": 3, "persembe": 4, "cuma": 5 };
      const d1 = dayOrder[cleanStr(a.day)] || 9;
      const d2 = dayOrder[cleanStr(b.day)] || 9;
      if (d1 !== d2) return d1 - d2;
      return (a.hour || 0) - (b.hour || 0);
    });

    const targetDay = selectedTimetableDay === "TODAY" ? getTodayTurkish() : selectedTimetableDay;

    const filtered = courses.filter(c => {
      if (selectedTimetableDay === "ALL") return true;
      return cleanStr(c.day) === cleanStr(targetDay);
    });

    if (filtered.length === 0) {
      resultsDiv.innerHTML = `<div class="empty-state"><span class="emoji">☕</span>${selectedTimetableDay === 'TODAY' ? 'Bugün dersiniz bulunmuyor!' : 'Bu gün için ders bulunamadı.'}</div>`;
      return;
    }

    let html = "";
    filtered.forEach(c => {
      const startH = String(c.hour || 8).padStart(2, "0");
      const timeStr = `${startH}:00 - ${startH}:45`;

      html += `
        <div class="course-card">
          <div class="course-card-top">
            <span class="course-time">${timeStr}</span>
            <span class="course-day-badge">${escapeHtml(c.day)}</span>
          </div>
          <div class="course-code">${escapeHtml(c.code || '')} ${c.section ? '(' + escapeHtml(c.section) + ')' : ''}</div>
          <div class="course-name">${escapeHtml(c.name || c.raw || '')}</div>
          <div class="course-details">
            <span>📍 ${escapeHtml(c.classroom || 'Derslik Belirtilmemiş')}</span>
            ${c.instructor ? `• <span class="course-instructor" data-instructor="${escapeHtml(c.instructor)}">👨‍🏫 ${escapeHtml(c.instructor)}</span>` : ''}
          </div>
        </div>
      `;
    });

    resultsDiv.innerHTML = html;

    // Hoca linklerine tıklama dinleyicisi
    resultsDiv.querySelectorAll(".course-instructor").forEach(el => {
      el.addEventListener("click", () => {
        const instName = el.dataset.instructor;
        openInstructorByName(instName);
      });
    });
  }

  // ============================================================
  // 3. HOCA DERS PROGRAMI
  // ============================================================
  let instructorIndex = {};
  const TITLE_TOKEN_RE = /^((?:prof|do[çc]|dr|[öo][ğg]r|g[öo]r|ar[şs]|lect)\.?|[üu]yesi)(?=\s|$)\s*/iu;
  const TITLE_WORD_RE = /^(?:(?:prof|do[çc]|dr|[öo][ğg]r|g[öo]r|ar[şs]|lect)\.?|[üu]yesi)$/iu;

  function instrKey(s) {
    return (s || "").toLocaleLowerCase("tr-TR")
      .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
      .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ").trim();
  }

  function canonicalTitle(raw) {
    const t = instrKey(raw);
    if (!t) return "";
    if (t.includes("prof")) return "Prof. Dr.";
    if (t.includes("doc")) return "Doç. Dr.";
    if (t.includes("uyesi")) return "Dr. Öğr. Üyesi";
    if (t.includes("ogr") && t.includes("gor")) return t.includes("dr") ? "Öğr. Gör. Dr." : "Öğr. Gör.";
    if (t.includes("ars") && t.includes("gor")) return t.includes("dr") ? "Arş. Gör. Dr." : "Arş. Gör.";
    if (t.includes("lect")) return "Öğr. Gör.";
    if (t.includes("dr")) return "Dr.";
    return "";
  }

  function parseInstructorField(raw) {
    if (!raw) return [];
    const result = [];
    String(raw).split(/\s*\/\s*(?=(?:Prof|Do[çc]|Dr|[ÖO][ğg]r|Ar[şs])\.)/u).forEach(seg => {
      let base = seg.split(",")[0].replace(/\.(?=\S)/g, ". ").trim();
      base = base.replace(/\s+(?:YB\/.*|[A-Z]\s?-\s?\S*\d.*)$/u, "");
      base = base.replace(/\s*-?\s*(?:uzaktan eğitim|mavi salon|çevrimiçi|online).*$/iu, "").trim();

      const words = base.split(/\s+/).filter(Boolean);
      let cleanWords = [];
      const titleTokens = [];
      words.forEach(w => {
        if (TITLE_WORD_RE.test(w)) titleTokens.push(w);
        else cleanWords.push(w);
      });
      const s = cleanWords.join(" ").trim();
      if (s.length >= 5 && cleanWords.length >= 2 && !/[\d()\-]/.test(s)) {
        result.push({ key: instrKey(s), name: s, title: canonicalTitle(titleTokens.join(" ")) });
      }
    });
    return result;
  }

  function buildInstructorIndex() {
    instructorIndex = {};
    Object.entries(rawPrograms).forEach(([progKey, prog]) => {
      (prog.courses || []).forEach(c => {
        parseInstructorField(c.instructor).forEach(p => {
          if (!instructorIndex[p.key]) {
            instructorIndex[p.key] = { key: p.key, name: p.name, title: p.title || "", depts: new Set(), slots: [] };
          }
          const inst = instructorIndex[p.key];
          if (p.title && !inst.title) inst.title = p.title;
          if (c.department || prog.department) inst.depts.add(c.department || prog.department);
          inst.slots.push({
            day: c.day, hour: c.hour, code: c.code, name: c.name,
            section: c.section, classroom: c.classroom, program: prog.title || progKey
          });
        });
      });
    });
  }

  function initInstructors() {
    buildInstructorIndex();
    const deptSelect = document.getElementById("inst-dept-filter");
    const depts = new Set();
    Object.values(instructorIndex).forEach(i => i.depts.forEach(d => depts.add(d)));
    Array.from(depts).sort().forEach(d => {
      deptSelect.innerHTML += `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`;
    });

    document.getElementById("inst-search").addEventListener("input", renderInstructors);
    deptSelect.addEventListener("change", renderInstructors);
    document.getElementById("btn-inst-back").addEventListener("click", () => {
      document.getElementById("inst-detail-box").classList.add("hidden");
      document.getElementById("inst-results").classList.remove("hidden");
    });

    renderInstructors();
  }

  function renderInstructors() {
    const q = instrKey(document.getElementById("inst-search").value);
    const dept = document.getElementById("inst-dept-filter").value;
    const resultsDiv = document.getElementById("inst-results");

    const items = Object.values(instructorIndex).filter(i => {
      if (q && !i.key.includes(q)) return false;
      if (dept && !i.depts.has(dept)) return false;
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name, "tr"));

    if (items.length === 0) {
      resultsDiv.innerHTML = `<div class="empty-state"><span class="emoji">🔍</span>Eşleşen hoca bulunamadı.</div>`;
      return;
    }

    resultsDiv.innerHTML = items.slice(0, 50).map(i => {
      const initials = i.name.split(" ").slice(0, 2).map(w => w[0]).join("").toLocaleUpperCase("tr-TR");
      const deptList = Array.from(i.depts).slice(0, 2).join(", ");
      return `
        <div class="inst-card" data-key="${escapeHtml(i.key)}">
          <div class="inst-avatar">${initials}</div>
          <div class="inst-info">
            <div class="inst-name">${escapeHtml(i.name)}</div>
            <div class="inst-sub">${escapeHtml(i.title || 'Öğretim Elemanı')} • ${escapeHtml(deptList || '')}</div>
          </div>
          <span style="color:#64748b; font-size:11px;">›</span>
        </div>
      `;
    }).join("");

    resultsDiv.querySelectorAll(".inst-card").forEach(card => {
      card.addEventListener("click", () => {
        showInstructorDetail(card.dataset.key);
      });
    });
  }

  function showInstructorDetail(key) {
    const inst = instructorIndex[key];
    if (!inst) return;

    document.getElementById("inst-results").classList.add("hidden");
    const detailBox = document.getElementById("inst-detail-box");
    detailBox.classList.remove("hidden");

    document.getElementById("inst-name").innerText = inst.name;
    document.getElementById("inst-title").innerText = inst.title || "Öğretim Elemanı";

    // Canlı durum hesapla
    const now = new Date();
    const dayIdx = now.getDay() - 1;
    const nowBadge = document.getElementById("inst-now-status");

    if (dayIdx < 0 || dayIdx > 4) {
      nowBadge.className = "now-badge idle";
      nowBadge.innerText = "🌙 Hafta sonu, ders yok.";
    } else {
      const today = cleanStr(DAYS[dayIdx]);
      const curHour = now.getHours();
      const curMin = now.getMinutes();

      const todaysSlots = inst.slots.filter(s => cleanStr(s.day) === today);
      const activeSlot = todaysSlots.find(s => s.hour === curHour && curMin < 45);

      if (activeSlot) {
        nowBadge.className = "now-badge active-class";
        nowBadge.innerText = `🟢 Şu an derste: ${activeSlot.code || ''} (${activeSlot.classroom || 'Sınıf Yok'})`;
      } else {
        const nextSlot = todaysSlots.filter(s => s.hour > curHour).sort((a, b) => a.hour - b.hour)[0];
        if (nextSlot) {
          nowBadge.className = "now-badge upcoming-class";
          nowBadge.innerText = `⏳ Sıradaki ders: ${String(nextSlot.hour).padStart(2, '0')}:00 (${nextSlot.classroom || ''})`;
        } else {
          nowBadge.className = "now-badge idle";
          nowBadge.innerText = todaysSlots.length ? "✓ Bugünkü dersleri bitti." : "📭 Bugün dersi yok.";
        }
      }
    }

    // Ders listesi
    const scheduleDiv = document.getElementById("inst-schedule-list");
    const sorted = inst.slots.slice().sort((a, b) => {
      const dayOrder = { "pazartesi": 1, "sali": 2, "carsamba": 3, "persembe": 4, "cuma": 5 };
      const d1 = dayOrder[cleanStr(a.day)] || 9;
      const d2 = dayOrder[cleanStr(b.day)] || 9;
      if (d1 !== d2) return d1 - d2;
      return (a.hour || 0) - (b.hour || 0);
    });

    scheduleDiv.innerHTML = sorted.map(s => `
      <div class="course-card">
        <div class="course-card-top">
          <span class="course-time">${String(s.hour).padStart(2, '0')}:00 - ${String(s.hour).padStart(2, '0')}:45</span>
          <span class="course-day-badge">${escapeHtml(s.day)}</span>
        </div>
        <div class="course-code">${escapeHtml(s.code || '')} ${s.section ? '(' + escapeHtml(s.section) + ')' : ''}</div>
        <div class="course-name">${escapeHtml(s.name || '')}</div>
        <div class="course-details">
          <span>📍 ${escapeHtml(s.classroom || '-')}</span>
          <span>• ${escapeHtml(s.program || '')}</span>
        </div>
      </div>
    `).join("");
  }

  function openInstructorByName(rawName) {
    const list = parseInstructorField(rawName);
    if (!list.length) return;
    const match = list.find(p => instructorIndex[p.key]);
    if (!match) return;
    switchTab("instructor");
    showInstructorDetail(match.key);
  }

  // ============================================================
  // 4. TASLAK & ÇAKIŞMA
  // ============================================================
  function initPlanner() {
    Storage.get("btu_planned_courses_v1", saved => {
      const courses = Array.isArray(saved) ? saved : [];
      renderPlanner(courses);
    });
  }

  function renderPlanner(courses) {
    const countBadge = document.getElementById("planner-count");
    const listDiv = document.getElementById("planner-courses-list");
    const alertBanner = document.getElementById("planner-conflict-banner");
    const alertText = document.getElementById("planner-conflict-text");

    countBadge.innerText = `${courses.length} Ders`;

    if (courses.length === 0) {
      listDiv.innerHTML = `
        <div class="empty-state">
          <span class="emoji">🧩</span>
          Henüz taslağınıza ders eklenmedi.<br>
          Web sitesi üzerinden ders seçimi yapabilirsiniz.
        </div>
      `;
      alertBanner.classList.add("hidden");
      return;
    }

    // Çakışma tespiti
    const slotMap = {};
    const conflicts = [];
    courses.forEach(c => {
      (c.slots || []).forEach(s => {
        const k = `${cleanStr(s.day)}_${s.hour}`;
        if (!slotMap[k]) slotMap[k] = [];
        slotMap[k].push({ course: c, slot: s });
        if (slotMap[k].length > 1) {
          conflicts.push(`${s.day} ${s.hour}:00 (${slotMap[k].map(x => x.course.code || x.course.name).join(" ve ")})`);
        }
      });
    });

    if (conflicts.length > 0) {
      alertBanner.classList.remove("hidden");
      alertText.innerHTML = conflicts.slice(0, 3).join("<br>");
    } else {
      alertBanner.classList.add("hidden");
    }

    listDiv.innerHTML = courses.map(c => `
      <div class="course-card">
        <div class="course-code">${escapeHtml(c.code || 'DERS')} (${escapeHtml(c.section || '-')})</div>
        <div class="course-name">${escapeHtml(c.name || '')}</div>
        <div class="course-details">
          <span>📚 ${escapeHtml(c.programTitle || '')}</span>
          <span>• ${(c.slots || []).length} saat/hafta</span>
        </div>
      </div>
    `).join("");
  }

  // ============================================================
  // BAŞLATICI
  // ============================================================
  document.addEventListener("DOMContentLoaded", () => {
    initTabs();
    initEmptyRooms();
    initTimetable();
    initInstructors();
    initPlanner();
  });
})();
