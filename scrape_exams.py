# -*- coding: utf-8 -*-
"""
BTU Sınav Takvimi Tarayıcısı (BTU Exam Schedule Scraper) - V2
YALNIZCA 2026-2027 Güz Yarıyılı Ara Sınav (Vize) Programlarını çeker.
Eski yıllar (25-26 vb.), bütünleme, final ve tek ders sınavları kesinlikle elenir.
Sınav PDF'lerindeki ders, tarih, saat ve derslik bilgileri tablo olarak ayrıştırılır.
"""
import os
import re
import io
import json
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, unquote
from datetime import datetime
try:
    import pdfplumber
except ImportError:
    pdfplumber = None

from departments import DEPARTMENTS

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

FACULTY_MAP = {
    "bilgisayar": "Mühendislik ve Doğa Bilimleri Fakültesi",
    "biyomuh": "Mühendislik ve Doğa Bilimleri Fakültesi",
    "cevre": "Mühendislik ve Doğa Bilimleri Fakültesi",
    "insaat": "Mühendislik ve Doğa Bilimleri Fakültesi",
    "gida": "Mühendislik ve Doğa Bilimleri Fakültesi",
    "fizik": "Mühendislik ve Doğa Bilimleri Fakültesi",
    "endustri": "Mühendislik ve Doğa Bilimleri Fakültesi",
    "elektrik": "Mühendislik ve Doğa Bilimleri Fakültesi",
    "kimya": "Mühendislik ve Doğa Bilimleri Fakültesi",
    "kimyamuh": "Mühendislik ve Doğa Bilimleri Fakültesi",
    "makine": "Mühendislik ve Doğa Bilimleri Fakültesi",
    "matematik": "Mühendislik ve Doğa Bilimleri Fakültesi",
    "mekatronik": "Mühendislik ve Doğa Bilimleri Fakültesi",
    "mekatroniking": "Mühendislik ve Doğa Bilimleri Fakültesi",
    "metalurji": "Mühendislik ve Doğa Bilimleri Fakültesi",
    "polimer": "Mühendislik ve Doğa Bilimleri Fakültesi",
    "veribilimi": "Mühendislik ve Doğa Bilimleri Fakültesi",
    "yapayzeka": "Mühendislik ve Doğa Bilimleri Fakültesi",
    "sosyoloji": "İnsan ve Toplum Bilimleri Fakültesi",
    "ui": "İnsan ve Toplum Bilimleri Fakültesi",
    "ui_ing": "İnsan ve Toplum Bilimleri Fakültesi",
    "utl": "İnsan ve Toplum Bilimleri Fakültesi",
    "isletme": "İnsan ve Toplum Bilimleri Fakültesi",
    "imtb": "İnsan ve Toplum Bilimleri Fakültesi",
    "psikoloji": "İnsan ve Toplum Bilimleri Fakültesi",
    "mimarlik": "Mimarlık ve Tasarım Fakültesi",
    "sehir": "Mimarlık ve Tasarım Fakültesi",
    "peyzaj": "Mimarlık ve Tasarım Fakültesi",
    "ormanendustri": "Orman Fakültesi",
    "orman": "Orman Fakültesi",
    "diy": "Denizcilik Fakültesi",
    "gigm": "Denizcilik Fakültesi"
}

# Kesinlikle aranacak kelimeler (2026-2027 Güz Ara Sınav / Vize)
EXAM_TYPE_KEYWORDS = ["ara sınav", "arasınav", "vize", "midterm"]
YEAR_KEYWORDS = ["2026-2027", "2026/2027", "2026 - 2027", "26-27", "26 - 27", "2026 güz", "26 güz"]

# KESİNLİKLE ELENECEKLER (Bütünleme, final, tek ders, eski yıllar vb.)
STRICT_EXCLUDE_WORDS = [
    "2025-2026", "2025 - 2026", "25-26", "25 - 26", "2024-2025", "2023-2024",
    "bütünleme", "butunleme", "final", "yarıyıl sonu", "yariyil sonu",
    "tek ders", "ek sınav", "yeterlik", "muafiyet", "yatay geçiş",
    "çift anadal", "doktora bilimsel", "mülakat", "personel", "öğrenci işleri staj",
    "bahar" # Bahar dönemi elenir, sadece Güz
]

def clean_text(text):
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()

def extract_date(text):
    m = re.search(r"(\d{2}[./-]\d{2}[./-]\d{4})", text)
    if m:
        return m.group(1).replace("/", ".").replace("-", ".")
    return None

def is_valid_2026_midterm(text, url):
    """Yalnızca 2026-2027 Güz Ara Sınav / Vize duyurularını onaylar."""
    combined = (clean_text(text) + " " + unquote(url)).lower()

    # 1. Yasaklı kelimeler varsa derhal reddet
    for ex in STRICT_EXCLUDE_WORDS:
        if ex in combined:
            return False

    # 2. Sınav türü ara sınav veya vize olmalı
    has_exam_type = any(kw in combined for kw in EXAM_TYPE_KEYWORDS)
    if not has_exam_type:
        return False

    # 3. Yıl 2026-2027 veya 26-27 olmalı (veya Ekim 2026 tarihli duyuru olmalı)
    has_year = any(yw in combined for yw in YEAR_KEYWORDS)
    is_recent_2026 = "10.2026" in combined or "09.2026" in combined or "11.2026" in combined

    return has_year or is_recent_2026

def parse_pdf_exam_table(pdf_bytes):
    """PDF içindeki sınav tablosunu ayrıştırır."""
    if not pdfplumber:
        return []
    
    exam_items = []
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                tables = page.extract_tables()
                for table in tables:
                    if not table or len(table) < 2:
                        continue
                    header = [clean_text(c).lower() for c in table[0] if c]
                    
                    # Başlık satırını analiz et
                    for row in table[1:]:
                        if not row or len(row) < 5:
                            continue
                        # Boş veya tekrar başlık satırlarını atla
                        if any("ders adı" in str(c).lower() for c in row[:3]):
                            continue
                        
                        # Standart fakülte formatı:
                        # [Index, Ders Adı, D.Kodu, Şb, Bölüm, Sınıf, Hoca, Mevcut, Sınav, Tür, Birleşen, Oturum, Derslik1...]
                        # Oturum: "03/11/2026 13.00-14.45"
                        row_str = " ".join([str(c) for c in row if c])
                        
                        # Oturum hücresini bul (Tarih ve Saat içeren hücre)
                        session_val = ""
                        for cell in row:
                            c_str = clean_text(cell)
                            if re.search(r"\d{2}[./-]\d{2}[./-]\d{4}", c_str):
                                session_val = c_str
                                break
                        
                        if not session_val:
                            continue
                            
                        # Tarih ve saat ayrıştırma
                        date_match = re.search(r"(\d{2})[./-](\d{2})[./-](\d{4})", session_val)
                        time_match = re.search(r"(\d{2}[:.]\d{2})\s*[-–]\s*(\d{2}[:.]\d{2})", session_val)
                        
                        exam_date = ""
                        if date_match:
                            exam_date = f"{date_match.group(1)}.{date_match.group(2)}.{date_match.group(3)}"
                            
                        exam_time = ""
                        if time_match:
                            exam_time = f"{time_match.group(1).replace('.', ':')} - {time_match.group(2).replace('.', ':')}"
                        else:
                            # Saat tek olabilir
                            single_t = re.search(r"(\d{2}[:.]\d{2})", session_val)
                            if single_t:
                                exam_time = single_t.group(1).replace(".", ":")

                        # Ders adı ve kodu
                        course_name = clean_text(row[1]) if len(row) > 1 else ""
                        course_code = clean_text(row[2]) if len(row) > 2 else ""
                        instructor = clean_text(row[6]) if len(row) > 6 else ""
                        grade = clean_text(row[5]) if len(row) > 5 else ""

                        # Derslikler (Oturum hücresinden sonraki dolu hücreler)
                        classrooms = []
                        session_idx = -1
                        for idx, cell in enumerate(row):
                            if cell == session_val:
                                session_idx = idx
                                break
                        if session_idx != -1:
                            for c in row[session_idx+1:]:
                                cl = clean_text(c)
                                if cl and len(cl) >= 2 and cl.upper() not in ["M", "MS", "YB", "VAR", "YOK"]:
                                    classrooms.append(cl)

                        if course_name or course_code:
                            exam_items.append({
                                "code": course_code,
                                "name": course_name,
                                "date": exam_date,
                                "time": exam_time,
                                "instructor": instructor,
                                "grade": grade,
                                "classrooms": ", ".join(classrooms) if classrooms else "Derslikler Açıklanacak",
                                "raw_session": session_val
                            })
    except Exception as e:
        print(f"[-] PDF ayrıştırma hatası: {e}")
        
    return exam_items

def find_pdf_links_in_page(url, parent_title=""):
    try:
        r = requests.get(url, headers=HEADERS, timeout=8)
        if r.status_code != 200:
            return []
        soup = BeautifulSoup(r.text, "html.parser")
        files = []
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            full_url = urljoin(url, href)
            lower_url = full_url.lower()
            if any(lower_url.endswith(ext) for ext in [".pdf", ".xlsx", ".xls", ".docx"]):
                raw_name = clean_text(a.get_text())
                if not raw_name or len(raw_name) < 4 or any(w in raw_name.lower() for w in ["tıklayınız", "indir", "buradan", "link", "ek"]):
                    title = f"2026-2027 Güz Ara Sınav Programı (PDF)"
                else:
                    title = raw_name
                
                # PDF'i indirip içindeki ders tablosunu ayrıştırmayı dene
                parsed_exams = []
                if lower_url.endswith(".pdf"):
                    try:
                        pdf_resp = requests.get(full_url, headers=HEADERS, timeout=12)
                        if pdf_resp.status_code == 200:
                            parsed_exams = parse_pdf_exam_table(pdf_resp.content)
                    except Exception:
                        pass
                
                files.append({
                    "title": title,
                    "url": full_url,
                    "ext": full_url.split(".")[-1].split("?")[0].lower(),
                    "exam_items": parsed_exams
                })
        return files
    except Exception:
        return []

def scrape_department_exams(dept_key, dept_info):
    url = dept_info.get("url")
    dept_name = dept_info.get("name", dept_key)
    faculty_name = FACULTY_MAP.get(dept_key, "BTÜ Fakültesi")
    
    result = {
        "key": dept_key,
        "name": dept_name,
        "faculty": faculty_name,
        "url": url,
        "has_announcement": False,
        "announcements": [],
        "last_checked": datetime.now().strftime("%d.%m.%Y %H:%M")
    }
    
    if not url:
        return result

    try:
        r = requests.get(url, headers=HEADERS, timeout=12)
        if r.status_code != 200:
            return result
        
        soup = BeautifulSoup(r.text, "html.parser")
        
        candidate_links = []
        duyuru_list_urls = []
        
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            text = clean_text(a.get_text())
            full_url = urljoin(url, href)
            
            if "/duyuru/birim/" in href or "/duyurular" in href:
                duyuru_list_urls.append(full_url)
            
            if is_valid_2026_midterm(text, full_url):
                candidate_links.append((text, full_url))
        
        if not candidate_links and duyuru_list_urls:
            archive_url = duyuru_list_urls[0]
            try:
                r_arch = requests.get(archive_url, headers=HEADERS, timeout=10)
                if r_arch.status_code == 200:
                    soup_arch = BeautifulSoup(r_arch.text, "html.parser")
                    for a in soup_arch.find_all("a", href=True):
                        href = a["href"].strip()
                        text = clean_text(a.get_text())
                        full_url = urljoin(archive_url, href)
                        if is_valid_2026_midterm(text, full_url):
                            candidate_links.append((text, full_url))
            except Exception:
                pass

        seen_urls = set()
        for title, item_url in candidate_links:
            if item_url in seen_urls:
                continue
            seen_urls.add(item_url)
            
            if len(title) < 5:
                title = unquote(item_url.split("/")[-1].replace("-", " ").capitalize())
            
            pub_date = extract_date(title)
            clean_title = re.sub(r"^\d{2}[./-]\d{2}[./-]\d{4}\s*", "", title).strip()
            
            files = []
            lower_item_url = item_url.lower()
            if lower_item_url.endswith(".pdf"):
                parsed = []
                try:
                    pdf_resp = requests.get(item_url, headers=HEADERS, timeout=12)
                    if pdf_resp.status_code == 200:
                        parsed = parse_pdf_exam_table(pdf_resp.content)
                except Exception:
                    pass
                files.append({
                    "title": "2026-2027 Güz Ara Sınav Programı (PDF)",
                    "url": item_url,
                    "ext": "pdf",
                    "exam_items": parsed
                })
            elif "/duyuru/detay/" in item_url:
                files = find_pdf_links_in_page(item_url, clean_title)
            
            # İçinde ayrıştırılmış sınav dersleri var mı topla
            all_items = []
            for f in files:
                all_items.extend(f.get("exam_items", []))
            
            result["announcements"].append({
                "title": clean_title if clean_title else title,
                "date": pub_date or "Ekim 2026",
                "url": item_url,
                "files": files,
                "exam_items": all_items
            })
            
        if result["announcements"]:
            result["has_announcement"] = True
            
    except Exception as e:
        print(f"[{dept_key}] Hata: {e}")
        
    return result

def main():
    print("=== BTÜ 2026-2027 Güz Ara Sınav (Vize) Programları Taranıyor ===")
    all_results = {}
    
    announced_count = 0
    total_depts = len(DEPARTMENTS)
    
    for key, info in DEPARTMENTS.items():
        data = scrape_department_exams(key, info)
        all_results[key] = data
        if data["has_announcement"]:
            announced_count += 1
            ann = data["announcements"][0]
            items_cnt = len(ann.get("exam_items", []))
            print(f"[+] {info['name']}: DUYURULDU ({ann['title']}) - {items_cnt} ders ayrıştırıldı.")
        else:
            print(f"[-] {info['name']}: Henüz duyurulmadı.")

    meta = {
        "term": "2026-2027 Güz Dönemi",
        "exam_type": "Ara Sınav (Vize)",
        "total_departments": total_depts,
        "announced_count": announced_count,
        "not_announced_count": total_depts - announced_count,
        "last_updated": datetime.now().strftime("%d.%m.%Y %H:%M")
    }
    
    final_output = {
        "meta": meta,
        "departments": all_results
    }

    with open("exam_schedules.json", "w", encoding="utf-8") as f:
        json.dump(final_output, f, ensure_ascii=False, indent=2)
        
    js_content = f"// BTÜ 2026-2027 Güz Ara Sınav Programları - Otomatik Oluşturuldu: {datetime.now().strftime('%d.%m.%Y %H:%M')}\n"
    js_content += f"window.EXAM_DATA = {json.dumps(final_output, ensure_ascii=False, indent=2)};\n"
    
    with open("exam_schedules.js", "w", encoding="utf-8") as f:
        f.write(js_content)
        
    print(f"\n[OK] Tamamlandı: {total_depts} bölümden {announced_count} tanesinde 2026-2027 Ara Sınavı bulundu.")
    print("[OK] Diğer bölümler kesinlikle 'Henüz Duyurulmadı' olarak işaretlendi.")

if __name__ == "__main__":
    main()
