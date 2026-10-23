import { DAYS } from '../theme/colors';

export function cleanStr(s) {
  if (!s) return '';
  return s.toString().trim().toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

export function getCampus(room) {
  if (!room) return 'MS';
  const r = room.toUpperCase();
  if (r.includes('YILDIRIM') || r.includes('YB /') || r.includes('YB-') || r.includes('YB/') || r.includes('YB ')) return 'YB';
  return 'MS';
}

export function getBlock(room) {
  if (!room) return 'Diğer Derslikler';
  const r = room.toUpperCase();
  if (r.includes('A BLOK') || r.startsWith('A/')) return 'A Blok';
  if (r.includes('B BLOK') || r.startsWith('B/')) return 'B Blok';
  if (r.includes('C BLOK') || r.startsWith('C/')) return 'C Blok';
  if (r.includes('D BLOK') || r.startsWith('D/')) return 'D Blok';
  if (r.includes('E BLOK') || r.startsWith('E/')) return 'E Blok';
  if (r.includes('F BLOK') || r.startsWith('F/')) return 'F Blok';
  if (r.includes('G BLOK') || r.startsWith('G/')) return 'G Blok';
  if (r.includes('AMFİ') || r.includes('AMFI')) return 'Amfiler';
  if (r.includes('LAB')) return 'Laboratuvarlar';
  return 'Diğer Derslikler';
}

// Derslik listesine karışan fiziksel olmayan kayıtları ayıklar
// (ör. "Uzaktan Eğitim", "Ö.Ü. Ofis", "Dr.Öğr.Üyesi X, A-266")
export function isPhysicalClassroom(room) {
  const r = cleanStr(room);
  if (!r) return false;
  if (/uzaktan|cevrimici|online|ofis|ofisi/.test(r)) return false;
  if (/(^|\s|\.)(prof|doc|dr|ogr|ars)\./.test(r)) return false;
  return true;
}

export function instrKey(s) {
  return (s || '').toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();
}

export function canonicalTitle(raw) {
  const t = instrKey(raw);
  if (!t) return '';
  if (t.includes('prof')) return 'Prof. Dr.';
  if (t.includes('doc')) return 'Doç. Dr.';
  if (t.includes('uyesi')) return 'Dr. Öğr. Üyesi';
  if (t.includes('ogr') && t.includes('gor')) return t.includes('dr') ? 'Öğr. Gör. Dr.' : 'Öğr. Gör.';
  if (t.includes('ars') && t.includes('gor')) return t.includes('dr') ? 'Arş. Gör. Dr.' : 'Arş. Gör.';
  if (t.includes('lect')) return t.includes('dr') ? 'Öğr. Gör. Dr.' : 'Öğr. Gör.';
  if (t.includes('dr')) return 'Dr.';
  return '';
}

// --- Hoca alanı ayrıştırma (web sürümündeki index.html ile aynı mantık) ---
const TITLE_TOKEN_RE = /^((?:prof|do[çc]|dr|[öo][ğg]r|g[öo]r|ar[şs]|lect)\.?|[üu]yesi)(?=\s|$)\s*/iu;
const TITLE_WORD_RE = /^(?:(?:prof|do[çc]|dr|[öo][ğg]r|g[öo]r|ar[şs]|lect)\.?|[üu]yesi)$/iu;
const TITLE_RANK = ['Prof. Dr.', 'Doç. Dr.', 'Dr. Öğr. Üyesi', 'Öğr. Gör. Dr.', 'Arş. Gör. Dr.', 'Dr.', 'Öğr. Gör.', 'Arş. Gör.'];
const titleRank = t => (t ? TITLE_RANK.indexOf(t) : 99);

// "Emre Dr. Öğr. Üyesi Enes" gibi ortaya gömülü unvanlarda metni parçalara ayırır
function splitOnEmbeddedTitles(s) {
  const parts = [];
  let cur = [];
  let prevTitle = false;
  s.split(/\s+/).filter(Boolean).forEach(w => {
    const isTitle = TITLE_WORD_RE.test(w);
    if (isTitle && cur.length && !prevTitle) { parts.push(cur.join(' ')); cur = []; }
    cur.push(w);
    prevTitle = isTitle;
  });
  if (cur.length) parts.push(cur.join(' '));
  return parts;
}

// Ham hoca alanını temiz isim(ler)e dönüştürür: unvan, derslik kodu, "Çevrimiçi" vb. ayıklanır
export function parseInstructorField(raw) {
  if (!raw) return [];
  const result = [];
  String(raw).split(/\s*\/\s*(?=(?:Prof|Do[çc]|Dr|[ÖO][ğg]r|Ar[şs])\.)/u).forEach(seg => {
    let base = seg.split(',')[0].replace(/\.(?=\S)/g, '. ').trim();
    base = base.replace(/\s+(?:YB\/.*|[A-Z]\s?-\s?\S*\d.*)$/u, '');
    base = base.replace(/\s*-?\s*(?:uzaktan eğitim|mavi salon|çevrimiçi|online).*$/iu, '').trim();
    splitOnEmbeddedTitles(base).forEach(part => {
      let s = part;
      const titleTokens = [];
      let m;
      while ((m = s.match(TITLE_TOKEN_RE))) { titleTokens.push(m[1]); s = s.slice(m[0].length); }
      const words = s.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
      while (words.length && TITLE_WORD_RE.test(words[words.length - 1])) words.pop();
      s = words.join(' ');
      if (!s || s.length < 5 || /[\d()\-]/.test(s) || words.length < 2) return;
      result.push({ key: instrKey(s), name: s, title: canonicalTitle(titleTokens.join(' ')) });
    });
  });
  return result;
}

// Tüm programlardan tekilleştirilmiş hoca dizini üretir.
// Aynı ders birden çok programda listelendiğinde saat bir kez sayılır.
export function buildInstructorIndex(programsData) {
  const index = {};
  Object.entries(programsData).forEach(([progKey, prog]) => {
    (prog.courses || []).forEach(c => {
      parseInstructorField(c.instructor).forEach(p => {
        if (!index[p.key]) {
          index[p.key] = { key: p.key, name: p.name, title: '', depts: new Set(), slots: new Map() };
        }
        const inst = index[p.key];
        if (p.title && titleRank(p.title) < titleRank(inst.title)) inst.title = p.title;
        if (c.department || prog.department) inst.depts.add(c.department || prog.department);

        const slotKey = `${cleanStr(c.day)}_${c.hour}_${c.code}_${c.section}_${c.classroom}`;
        if (!inst.slots.has(slotKey)) {
          inst.slots.set(slotKey, {
            day: c.day, hour: c.hour, code: c.code, name: c.name, type: c.type,
            section: c.section, classroom: c.classroom, programs: new Set()
          });
        }
        inst.slots.get(slotKey).programs.add(prog.title || progKey);
      });
    });
  });

  // Tabloda kesik yazılmış isimleri (ör. "Ali İhsan") tam isimle birleştir
  const aliases = {};
  Object.keys(index).sort((a, b) => a.length - b.length).forEach(k => {
    const a = index[k];
    if (!a) return;
    let cands = Object.keys(index).filter(o => o !== k && o.startsWith(k + ' '));
    if (cands.length > 1) cands = cands.filter(o => [...a.depts].some(d => index[o].depts.has(d)));
    if (cands.length !== 1) return;
    const b = index[cands[0]];
    a.slots.forEach((s, sk) => {
      if (b.slots.has(sk)) s.programs.forEach(pr => b.slots.get(sk).programs.add(pr));
      else b.slots.set(sk, s);
    });
    a.depts.forEach(d => b.depts.add(d));
    if (titleRank(a.title) < titleRank(b.title)) b.title = a.title;
    aliases[k] = b.key;
    Object.keys(aliases).forEach(x => { if (aliases[x] === k) aliases[x] = b.key; });
    delete index[k];
  });

  return { index, aliases };
}

// Bugünün hafta içi gün adı; hafta sonu null döner
export function getTodayName() {
  const dayIndex = new Date().getDay(); // 0 Pazar, 1 Pazartesi...
  return dayIndex >= 1 && dayIndex <= 5 ? DAYS[dayIndex - 1] : null;
}

// Seçim ekranları için varsayılan gün: hafta sonu Pazartesi
export function getCurrentDay() {
  return getTodayName() || 'Pazartesi';
}

export function getCurrentHour() {
  return new Date().getHours();
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

// Aynı dersin art arda gelen saatlerini tek blokta birleştirir (08:00-10:45 gibi)
export function mergeConsecutiveSlots(slots, keyOf = s => `${s.code}|${s.name}|${s.section}|${s.classroom}`) {
  const sorted = [...slots].sort((a, b) => a.hour - b.hour);
  const blocks = [];
  const openByKey = {};
  sorted.forEach(s => {
    const k = keyOf(s);
    const last = openByKey[k];
    if (last && s.hour === last.endHour + 1) {
      last.endHour = s.hour;
      last.items.push(s);
    } else if (!last || s.hour !== last.endHour) {
      const block = { first: s, startHour: s.hour, endHour: s.hour, items: [s] };
      blocks.push(block);
      openByKey[k] = block;
    }
  });
  return blocks.sort((a, b) => a.startHour - b.startHour);
}

export function parseExamDate(dateStr, timeStr) {
  // Biçim: "03.11.2026", saat: "13:00 - 14:45"
  if (!dateStr) return null;
  const parts = dateStr.split('.');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  let hour = 0;
  let minute = 0;
  const t = timeStr && String(timeStr).match(/(\d{1,2})[:.](\d{2})/);
  if (t) {
    hour = parseInt(t[1], 10);
    minute = parseInt(t[2], 10);
  }
  const d = new Date(year, month, day, hour, minute);
  return isNaN(d.getTime()) ? null : d;
}

export function getExamCountdown(dateStr) {
  const examDate = parseExamDate(dateStr);
  if (!examDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.round((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: 'Geçti', color: '#64748b', days: diffDays };
  } else if (diffDays === 0) {
    return { text: 'BUGÜN', color: '#f43f5e', days: 0 };
  } else if (diffDays === 1) {
    return { text: 'YARIN', color: '#f59e0b', days: 1 };
  } else if (diffDays <= 7) {
    return { text: `${diffDays} gün kaldı`, color: '#f59e0b', days: diffDays };
  }
  return { text: `${diffDays} gün kaldı`, color: '#10b981', days: diffDays };
}

// Taslaktaki dersleri, seçili bölümün (ve ortak "_genel") sınav listesiyle eşleştirir
export function matchPlanToExams(plannedCourses, examsData, deptKey) {
  const depts = (examsData && examsData.departments) || {};
  const seen = new Set();
  const matched = [];
  (plannedCourses || []).forEach(uc => {
    const ucCode = cleanStr(uc.code).replace(/\s+/g, '');
    const ucName = cleanStr(uc.name).replace(/\s*\((lab|uyg)\)\s*$/, '');
    Object.entries(depts).forEach(([dKey, d]) => {
      if (deptKey && dKey !== deptKey && dKey !== '_genel') return;
      (d.announcements || []).slice(0, 1).forEach(ann => {
        (ann.exam_items || []).forEach(item => {
          const itCode = cleanStr(item.code).replace(/\s+/g, '');
          const itName = cleanStr(item.name);
          const codeMatch = ucCode && itCode && ucCode === itCode;
          const nameMatch = !codeMatch && ucName.length > 3 && itName && itName === ucName;
          if (!codeMatch && !nameMatch) return;
          const uid = `${item.code}_${item.date}_${item.time}_${dKey}`;
          if (seen.has(uid)) return;
          seen.add(uid);
          matched.push({ ...item, deptKey: dKey, deptName: d.name });
        });
      });
    });
  });
  return matched.sort((a, b) => {
    const da = parseExamDate(a.date, a.time);
    const db = parseExamDate(b.date, b.time);
    return (da ? da.getTime() : Infinity) - (db ? db.getTime() : Infinity);
  });
}
