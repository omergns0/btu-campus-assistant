import { APP_CONFIG } from '../config/appConfig';
import { StorageService } from './storageService';
import { cleanStr, getTodayName, getCurrentHour, isPhysicalClassroom, pad2 } from '../utils/helpers';
import { DAYS } from '../theme/colors';
import programsData from '../data/programs.json';
import classroomsData from '../data/classrooms.json';
import examsData from '../data/exams.json';

// Eşleştirmede gürültü yaratan yaygın kelimeler (ör. "sınıf" her program adında geçer)
const STOP_WORDS = new Set([
  'bir', 'var', 'mi', 'mu', 'icin', 'ile', 'olan', 'hangi', 'nedir', 'nerede', 'ne', 'zaman',
  'bugun', 'yarin', 'saat', 'sinif', 'sinifi', 'ders', 'dersi', 'dersleri', 'dersler', 'programi',
  'program', 'bos', 'derslik', 'amfi', 'hoca', 'hocasi', 'hocanin', 'sinav', 'vize', 'final',
  'tarih', 'tarihleri', 'acikladi', 'aciklandi', 'muhendisligi', 'bolumu', 'bolum', 'gore', 'kac',
  'pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'yerleske', 'yerleskesinde', 'kampus',
  'kampusunde', 'hocanin', 'programini', 'nerde', 'simdi', 'su', 'an'
]);
const CAMPUS_WORDS = new Set(['yildirim', 'mimar', 'sinan']);

// Hoca adı kelimeleriyle tam kelime (veya en az 5 harflik önek) eşleşmesi
function nameScore(normName, words) {
  const tokens = normName.replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  return words.filter(w => tokens.some(t => t === w || (w.length >= 5 && t.startsWith(w)))).length;
}

export function buildCampusContext(query) {
  const normQuery = cleanStr(query);
  const matchedSnippets = [];
  const today = getTodayName();
  const currentHour = getCurrentHour();

  const words = normQuery
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  const gradeMatch = normQuery.match(/\b([1-4])\s*\.?\s*sinif/);

  // 1. Bölüm / program dersleri
  const progMatches = [];
  Object.entries(programsData).forEach(([progKey, prog]) => {
    const hay = `${cleanStr(progKey)} ${cleanStr(prog.title || '')} ${cleanStr(prog.department || '')}`;
    let score = words.filter(w => hay.includes(w)).length;
    if (score > 0 && gradeMatch && String(prog.grade) === gradeMatch[1]) score += 2;
    if (score > 0) progMatches.push({ key: progKey, prog, score });
  });
  progMatches.sort((a, b) => b.score - a.score);

  if (progMatches.length > 0) {
    const topProg = progMatches[0].prog;
    const courses = [...(topProg.courses || [])]
      .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.hour - b.hour)
      .slice(0, 25);
    const courseLines = courses.map(c =>
      `- ${c.day} ${pad2(c.hour)}:00 [${c.code || ''}] ${c.name} (${c.section || ''}) - Derslik: ${c.classroom || '-'} - Hoca: ${c.instructor || '-'}`
    ).join('\n');
    matchedSnippets.push(`[${topProg.title || progMatches[0].key} Dersleri]:\n${courseLines}`);
  }

  // 2. Öğretim elemanları: yalnızca en çok kelimesi eşleşen isimler
  // (kampüs soruları "Yıldırım" kelimesini hoca soyadı sanmasın)
  const isRoomQuery = /\bbos\b|derslik|amfi|laboratuvar|yerleske|kampus/.test(normQuery);
  const nameWords = words.filter(w => w.length >= 4 && !(isRoomQuery && CAMPUS_WORDS.has(w)));
  if (nameWords.length > 0) {
    const instrMap = {};
    let best = 0;
    Object.values(programsData).forEach(prog => {
      (prog.courses || []).forEach(c => {
        if (!c.instructor || c.instructor.length <= 3) return;
        const score = nameScore(cleanStr(c.instructor), nameWords);
        if (score === 0) return;
        best = Math.max(best, score);
        if (!instrMap[c.instructor]) instrMap[c.instructor] = { score, lines: new Set() };
        instrMap[c.instructor].lines.add(`- ${c.day} ${pad2(c.hour)}:00 ${c.code || ''} ${c.name} (${c.classroom || '-'})`);
      });
    });
    Object.entries(instrMap)
      .filter(([, v]) => v.score === best)
      .slice(0, 3)
      .forEach(([name, v]) => {
        matchedSnippets.push(`[Öğretim Elemanı: ${name} Programı]:\n${[...v.lines].slice(0, 10).join('\n')}`);
      });
  }

  // 3. Boş derslikler
  if (/\bbos\b|sinif|derslik|amfi|laboratuvar/.test(normQuery)) {
    let targetDay = today || 'Pazartesi';
    if (normQuery.includes('yarin')) {
      const jsDay = new Date().getDay(); // 0 Pazar
      targetDay = jsDay >= 0 && jsDay <= 4 ? DAYS[jsDay] : 'Pazartesi';
    } else {
      const named = DAYS.find(d => normQuery.includes(cleanStr(d)));
      if (named) targetDay = named;
    }

    // "13:00", "13.00", "saat 13", "13'te", "14'de" gibi ifadeler
    let targetHour = currentHour >= 8 && currentHour <= 19 ? currentHour : 13;
    const hourMatch = normQuery.match(/(?:saat\s*)?\b(0?[89]|1\d)(?:[:.]00|\s*['’]?\s*(?:te|ta|de|da)\b)/)
      || normQuery.match(/saat\s*(0?[89]|1\d)\b/);
    if (hourMatch) {
      const parsedH = parseInt(hourMatch[1], 10);
      if (parsedH >= 8 && parsedH <= 19) targetHour = parsedH;
    }

    const wantsYildirim = normQuery.includes('yildirim');
    const findEmpty = (onlyAmfi) => Object.entries(classroomsData).filter(([room, schedules]) => {
      if (!isPhysicalClassroom(room)) return false;
      const r = cleanStr(room);
      if (wantsYildirim && !/yildirim|yb\b|yb\//.test(r)) return false;
      if (onlyAmfi && !r.includes('amfi')) return false;
      return !(schedules || []).some(s => {
        if (cleanStr(s.day) !== cleanStr(targetDay)) return false;
        const h = s.hour !== undefined ? parseInt(s.hour, 10) : parseInt(s.start, 10);
        return h === targetHour;
      });
    }).map(([room]) => room);

    let emptyRooms = findEmpty(normQuery.includes('amfi'));
    let label = 'Boş Olan Derslikler';
    if (normQuery.includes('amfi') && emptyRooms.length === 0) {
      emptyRooms = findEmpty(false);
      label = 'Boş Amfi Bulunamadı, Boş Olan Diğer Derslikler';
    }
    const campusLabel = wantsYildirim ? 'Yıldırım Yerleşkesi ' : '';

    matchedSnippets.push(`[${campusLabel}${targetDay} Günü Saat ${pad2(targetHour)}:00 ${label} (${emptyRooms.length} Adet)]:\n${emptyRooms.slice(0, 20).join(', ')}`);
  }

  // 4. Sınavlar
  if (/sinav|vize|final|tarih/.test(normQuery)) {
    const depts = examsData.departments || {};
    const matchedExams = [];
    const seenExams = new Set();
    const codeWords = normQuery.match(/\b[a-z]{2,4}\s?\d{3,4}\b/g) || [];

    Object.values(depts).forEach(dept => {
      const normDeptName = cleanStr(dept.name || '');
      const ann = (dept.announcements || [])[0];
      const deptHit = words.some(w => normDeptName.includes(w));
      if (codeWords.length && ann) {
        (ann.exam_items || []).forEach(it => {
          const c = cleanStr(it.code).replace(/\s+/g, '');
          const uid = `${c}_${it.date}_${it.time}`;
          if (codeWords.some(cw => cw.replace(/\s+/g, '') === c) && !seenExams.has(uid)) {
            seenExams.add(uid);
            matchedExams.push(`- ${it.code} ${it.name}: ${it.date} ${it.time || ''} • ${it.classrooms || 'Derslik açıklanacak'}`);
          }
        });
      } else if (deptHit || words.length === 0) {
        if (ann) matchedExams.push(`- ${dept.name}: [${dept.status_label}] "${ann.title}" (Tarih: ${ann.date})`);
        else matchedExams.push(`- ${dept.name}: Henüz duyurulmadı`);
      }
    });

    if (matchedExams.length > 0) {
      matchedSnippets.push(`[Ara Sınav (Vize) Bilgileri]:\n${matchedExams.slice(0, 12).join('\n')}`);
    }
  }

  return matchedSnippets.join('\n\n');
}

// history: [{ role: 'user' | 'assistant', text }] — son mesajlar bağlam için gönderilir
export async function askGemini(question, history = []) {
  const context = buildCampusContext(question);
  const customKey = await StorageService.getApiKey();
  const apiKey = (customKey || APP_CONFIG.GEMINI_API_KEY || '').trim();

  if (!apiKey || apiKey.startsWith('YOUR_')) {
    return generateLocalFallback(context, 'Yapay zeka anahtarı tanımlı olmadığı için yanıt doğrudan yerel BTÜ veri tabanından hazırlandı.');
  }

  const systemPrompt = `Sen Bursa Teknik Üniversitesi (BTÜ) öğrencileri için geliştirilmiş yapay zeka kampüs asistanısın.
Adın: "BTÜ Kampüs Asistanı". Bugün: ${new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.
Aşağıdaki BTÜ akademik veri tabanı bağlamını kullanarak öğrencinin sorusuna nazik, net ve Türkçe cevap ver.

Önemli Kurallar:
- Sadece verilen bağlamdaki verilere dayan.
- Sınıf, saat, ders kodu ve hoca isimlerini **kalın** yaz.
- Bilgi bağlamda yoksa uydurma; ilgili bölüm veya öğrenci işleriyle görüşmesini öner.`;

  const userPrompt = `Veri Tabanı Bağlamı:
${context || 'İlgili veri tabanı kaydı bulunamadı.'}

Öğrencinin Sorusu:
${question}`;

  const priorTurns = history
    .filter(m => m.id !== 'welcome' && m.text)
    .slice(-6)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));

  const candidateModels = [APP_CONFIG.GEMINI_MODEL, ...(APP_CONFIG.GEMINI_FALLBACK_MODELS || [])]
    .filter((v, i, a) => v && a.indexOf(v) === i);

  let lastStatus = null;

  for (const model of candidateModels) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [...priorTurns, { role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 800 }
        })
      });

      lastStatus = res.status;

      // Geçersiz anahtar / yetki hatasında diğer modelleri denemenin anlamı yok
      if (res.status === 400 || res.status === 401 || res.status === 403) break;
      // Kota (429), yoğunluk (503) veya kaldırılmış model (404): sıradaki modeli dene
      if (!res.ok) continue;

      const data = await res.json();
      const answer = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
      if (answer) return answer;
    } catch (err) {
      lastStatus = 'network';
    }
  }

  let notice = 'Yapay zeka sunucusu yanıt vermediği için yanıt doğrudan yerel BTÜ veri tabanından hazırlandı.';
  if (lastStatus === 429) {
    notice = 'Ortak Gemini kotası anlık olarak dolduğu için yanıt yerel veri tabanından hazırlandı. Sağ üstteki anahtar simgesinden kendi ücretsiz Gemini anahtarınızı ekleyebilirsiniz.';
  } else if (lastStatus === 400 || lastStatus === 401 || lastStatus === 403) {
    notice = 'Gemini API anahtarı geçersiz veya yetkisiz. Sağ üstteki anahtar simgesinden geçerli bir anahtar girin.';
  } else if (lastStatus === 'network') {
    notice = 'İnternet bağlantısı kurulamadığı için yanıt çevrimdışı yerel veri tabanından hazırlandı.';
  }

  return generateLocalFallback(context, notice);
}

function generateLocalFallback(context, notice) {
  if (!context || context.trim().length === 0) {
    return 'Sorunuzla doğrudan eşleşen bir ders, derslik veya sınav kaydı bulunamadı. Lütfen bölüm adını, ders kodunu veya derslik adını belirterek tekrar sorun.\n\n*(Örnek: "Bilgisayar Mühendisliği 2. sınıf dersleri" veya "Salı 14:00 boş derslik")*';
  }

  const formattedLines = context
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']:')) {
        return `\n📌 **${trimmed.slice(1, -2)}**`;
      }
      if (trimmed.startsWith('-')) {
        return `• ${trimmed.substring(1).trim()}`;
      }
      return trimmed;
    })
    .join('\n');

  let text = '🎓 **BTÜ Kampüs Veri Tabanı Yanıtı:**' + formattedLines;
  if (notice) {
    text += `\n\n*(ℹ️ ${notice})*`;
  }
  return text;
}
