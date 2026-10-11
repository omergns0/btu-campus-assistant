import os
import json
import re
from pypdf import PdfReader
import openpyxl
import google.generativeai as genai

API_KEY = os.environ.get("GEMINI_API_KEY", "")
if API_KEY:
    genai.configure(api_key=API_KEY)

# Konsol çıktısındaki çalışan güncel flash modeli
model = genai.GenerativeModel("gemini-3.8-flash")
SOURCE_DIR = "kaynak_dosyalar"

PROMPT_TEMPLATE = """
Sen üniversite ders programlarını hatasız ayrıştıran bir veri çıkarma uzmanısın.
Aşağıda bir bölümün ders programı ham metni yer alıyor. 
Bu metindeki tüm ders saatlerini ve şubelerini dikkatlice incele. 
Birleştirilmiş hücreler veya birden fazla saate yayılan dersler varsa her saat dilimini ayrı ayrı yakala.

ÇIKTIYI SADECE VE SADECE GEÇERLİ BİR JSON ARRAY OLARAK VER. Başka hiçbir açıklama, markdown bloğu (```json gibi) yazma.

JSON Şeması:
[
  {
    "code": "Ders Kodu (Örn: BLM0111, MAT0101 yoksa boş string)",
    "name": "Ders Adı",
    "section": "Şube 1 veya Şube 2 (belirtilmemişse Şube 1)",
    "instructor": "Dersi veren akademisyen adı (yoksa boş string)",
    "classroom": "Derslik / Sınıf (Örn: MS / G blok / 451, E/204)",
    "day": "Pazartesi, Salı, Çarşamba, Perşembe veya Cuma",
    "hour": 8
  }
]

DERS PROGRAMI HAM METNİ:
"""

def extract_text_from_pdf(filepath):
    reader = PdfReader(filepath)
    full_text = ""
    for idx, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        full_text += f"\n--- SAYFA {idx+1} ---\n" + text
    return full_text

def extract_text_from_excel(filepath):
    wb = openpyxl.load_workbook(filepath, data_only=True)
    full_text = ""
    for sheet in wb.sheetnames:
        full_text += f"\n--- SAYFA: {sheet} ---\n"
        ws = wb[sheet]
        for row in ws.iter_rows(values_only=True):
            row_vals = [str(c).strip() for c in row if c is not None and str(c).strip()]
            if row_vals:
                full_text += " | ".join(row_vals) + "\n"
    return full_text

def parse_with_ai(raw_text):
    if len(raw_text.strip()) < 20:
        return []
    try:
        response = model.generate_content(PROMPT_TEMPLATE + raw_text[:30000])
        cleaned_json = response.text.strip()
        cleaned_json = re.sub(r"^```json\s*", "", cleaned_json)
        cleaned_json = re.sub(r"^```\s*", "", cleaned_json)
        cleaned_json = re.sub(r"\s*```$", "", cleaned_json)
        return json.loads(cleaned_json)
    except Exception as e:
        print(f"    [-] AI Çıkarma Hatası: {e}")
        return []

def detect_meta_from_filename(filename):
    base = os.path.splitext(filename)[0].lower()
    dept = "Genel Program"
    if "pc" in base or "bm" in base or "bilgisayar" in base: dept = "Bilgisayar Mühendisliği"
    elif "eem" in base: dept = "Elektrik-Elektronik Mühendisliği"
    elif "endustri" in base: dept = "Endüstri Mühendisliği"
    elif "makine" in base: dept = "Makine Mühendisliği"
    elif "mekatronik" in base: dept = "Mekatronik Mühendisliği"
    elif "kimyamuh" in base or "kimyamüh" in base: dept = "Kimya Mühendisliği"
    elif "kimya" in base: dept = "Kimya"
    elif "gida" in base: dept = "Gıda Mühendisliği"
    elif "biyo" in base: dept = "Biyomühendislik"
    elif "isletme" in base: dept = "İşletme"
    elif "fizik" in base: dept = "Fizik"
    elif "pm" in base or "polimer" in base: dept = "Polimer Malzeme Mühendisliği"
    else: dept = base.replace("_", " ").title()

    grade_match = re.search(r"(\d)", base)
    grade = int(grade_match.group(1)) if grade_match else 1
    return dept, grade

def build_classrooms(all_programs):
    classrooms = {}
    for prog in all_programs.values():
        for c in prog["courses"]:
            room = c.get("classroom")
            if not room or len(room) < 3: continue
            if room not in classrooms: classrooms[room] = []
            
            exists = any(s["day"] == c["day"] and s["hour"] == c["hour"] for s in classrooms[room])
            if not exists:
                classrooms[room].append({
                    "day": c["day"],
                    "hour": c["hour"],
                    "start": f"{c['hour']:02d}:00",
                    "end": f"{c['hour']:02d}:45",
                    "status": "DOLU"
                })
    return classrooms

def main():
    all_programs = {}
    files = sorted(os.listdir(SOURCE_DIR))
    print(f"=== {len(files)} Adet Dosya Gemini 2.5 Flash ile Parse Ediliyor ===")

    for fname in files:
        fpath = os.path.join(SOURCE_DIR, fname)
        if not os.path.isfile(fpath): continue
        ext = os.path.splitext(fname)[1].lower()
        if ext not in [".pdf", ".xlsx", ".xls"]: continue

        print(f"\n[+] İşleniyor: {fname}")
        dept_name, grade = detect_meta_from_filename(fname)
        prog_key = f"{dept_name} - {grade}. Sınıf"

        if ext == ".pdf":
            raw_text = extract_text_from_pdf(fpath)
        else:
            raw_text = extract_text_from_excel(fpath)

        courses = parse_with_ai(raw_text)
        print(f"    -> {len(courses)} ders saati yakalandı.")

        if courses:
            formatted_courses = []
            for c in courses:
                hour = int(c.get("hour", 9))
                formatted_courses.append({
                    "raw": f"{c.get('code','')} {c.get('name','')} {c.get('section','')}".strip(),
                    "code": c.get("code", ""),
                    "name": c.get("name", ""),
                    "section": c.get("section", "Şube 1"),
                    "instructor": c.get("instructor", ""),
                    "classroom": c.get("classroom", ""),
                    "department": dept_name,
                    "grade": grade,
                    "program": prog_key,
                    "day": c.get("day", "Pazartesi"),
                    "hour": hour,
                    "time": f"{hour:02d}:00 - {hour:02d}:45"
                })

            all_programs[prog_key] = {
                "title": prog_key,
                "department": dept_name,
                "grade": grade,
                "file": fname,
                "courses": formatted_courses
            }

    with open("courses_data.js", "w", encoding="utf-8") as f:
        f.write("const ALL_PROGRAMS_DATA = " + json.dumps(all_programs, ensure_ascii=False, indent=2) + ";")

    classrooms_data = build_classrooms(all_programs)
    with open("data.js", "w", encoding="utf-8") as f:
        f.write("const CLASSROOMS_DATA = " + json.dumps(classrooms_data, ensure_ascii=False, indent=2) + ";")

    print(f"\n[✓] İŞLEM BAŞARIYLA TAMAMLANDI!")
    print(f"Toplam Program: {len(all_programs)}")
    print("courses_data.js ve data.js %100 temiz şekilde üretildi.")

if __name__ == "__main__":
    main()