import os
import re
import json
import pdfplumber
import openpyxl

DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"]

DEPT_DICTIONARY = {
    "bm": "Bilgisayar Mühendisliği",
    "pc": "Bilgisayar Mühendisliği",
    "bilgisayar": "Bilgisayar Mühendisliği",
    "ceng": "Bilgisayar Mühendisliği",
    "eem": "Elektrik-Elektronik Mühendisliği",
    "makine": "Makine Mühendisliği",
    "mekatronik": "Mekatronik Mühendisliği",
    "endustri": "Endüstri Mühendisliği",
    "insaat": "İnşaat Mühendisliği",
    "kimyamuh": "Kimya Mühendisliği",
    "kimyamüh": "Kimya Mühendisliği",
    "kimya": "Kimya",
    "biyomuhendis": "Biyomühendislik",
    "gida_muh": "Gıda Mühendisliği",
    "yapayzeka": "Yapay Zeka ve Veri Mühendisliği",
    "isletme": "İşletme",
    "fizik": "Fizik",
    "matematik": "Matematik"
}

DOWNLOAD_DIR = "kaynak_dosyalar"

def clean(text):
    if text is None: return ""
    return re.sub(r"\s+", " ", str(text)).strip()

def detect_meta(filename):
    base = os.path.splitext(filename)[0].lower()
    base = re.sub(r"[\s\-_]+", "", base)
    
    dept = "Genel Program"
    for k, v in DEPT_DICTIONARY.items():
        if k in base:
            dept = v
            break
            
    grade_match = re.search(r"(\d)(?:sinif|snf|\.sinif)?", base)
    grade = int(grade_match.group(1)) if grade_match else 1
    return dept, grade

def extract_course_details(raw_cell):
    text = clean(raw_cell)
    if len(text) < 3: return []
    
    # "Derslik", "Öğle Arası", "Tatil" gibi hücreleri ele
    if any(k in text.lower() for k in ["öğle arası", "ogle arasi", "yemek", "danışmanlık"]):
        return []

    # Kod tespiti (Örn: BLM101, MAT0101, FZK-101 vb.)
    code_match = re.search(r"\b([A-ZÇĞİÖŞÜ]{2,5}\s*[-_]?\s*\d{3,4})\b", text)
    code = code_match.group(1).replace(" ", "").replace("-", "") if code_match else ""

    # Şube tespiti
    sec_match = re.search(r"(?:Şube|Sube|Grup)\s*(\d+)", text, re.IGNORECASE)
    section = f"Şube {sec_match.group(1)}" if sec_match else "Şube 1"

    # Derslik tespiti
    room_match = re.search(r"((?:MS|YB)\s*/[^,]+|[A-Z]/\d+[^,]*|[\w\s]+Laboratuvar[\w\s\.]*|[\w\s]+Amfi[\w\s]*)", text, re.IGNORECASE)
    classroom = room_match.group(1).strip() if room_match else ""

    # İsim tespiti
    lines = [clean(l) for l in text.split("\n") if clean(l)]
    course_name = lines[0] if lines else text
    if code and code in course_name:
        course_name = course_name.replace(code, "").strip(",- ")

    # Hoca tespiti
    instructor = ""
    for part in re.split(r"[,/]", text):
        part = clean(part)
        if any(t in part.lower() for t in ["prof", "doç", "dr", "öğr", "gör", "arş"]):
            instructor = part
            break

    return [{
        "raw": text,
        "code": code,
        "name": course_name or code or text,
        "section": section,
        "instructor": instructor,
        "classroom": classroom
    }]

def parse_pdf_file(filepath, dept_name, default_grade):
    courses = []
    with pdfplumber.open(filepath) as pdf:
        for p_idx, page in enumerate(pdf.pages, start=1):
            # Çizgili ve çizgisiz karmaşık tablolar için en esnek toleranslar
            tables = page.extract_tables({
                "vertical_strategy": "text",
                "horizontal_strategy": "text",
                "snap_tolerance": 8,
                "join_tolerance": 8
            })
            if not tables:
                tables = page.extract_tables() # Yedek çizgili mod

            for table in tables:
                if not table or len(table) < 2: continue
                
                # Gün başlıklarını bul
                day_cols = {}
                header_idx = -1
                for r_idx, row in enumerate(table):
                    row_txt = [clean(c).lower() for c in row if c]
                    found = {}
                    for c_idx, cell in enumerate(row):
                        c_str = clean(cell).lower()
                        for d in DAYS:
                            if d.lower() in c_str:
                                found[d] = c_idx
                    if len(found) >= 3:
                        day_cols = found
                        header_idx = r_idx
                        break

                if header_idx == -1: continue

                # Saat satırlarını tara
                for row in table[header_idx + 1:]:
                    # Saati ilk 2 sütunda ara
                    hour = None
                    for c in row[:2]:
                        m = re.search(r"(\d{1,2}):\d{2}", clean(c))
                        if m:
                            hour = int(m.group(1))
                            break
                    if not hour: continue

                    for day, c_idx in day_cols.items():
                        if c_idx < len(row) and row[c_idx]:
                            for item in extract_course_details(row[c_idx]):
                                courses.append({
                                    **item,
                                    "department": dept_name,
                                    "grade": default_grade,
                                    "day": day,
                                    "hour": hour,
                                    "time": f"{hour:02d}:00 - {hour:02d}:45"
                                })
    return courses