# -*- coding: utf-8 -*-
import os
import re
import sys
import io
import json
from departments import DEPARTMENTS, ALIAS_TO_KEY
import schedule_parser

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

def detect_dept_and_grade(filename):
    base = os.path.splitext(filename)[0].lower()
    m_grade = re.search(r'[-_]?([1-6])$', base)
    file_grade = int(m_grade.group(1)) if m_grade else None

    # Strip grade digit and separators from end for alias lookup
    clean_base = re.sub(r'[-_]?([1-6])$', '', base).strip('-_ ')
    dept_name = None

    parts = base.split('_')
    for candidate in [clean_base, parts[0], '_'.join(parts[:-1])]:
        cand_clean = candidate.rstrip('0123456789-_ ')
        if cand_clean in ALIAS_TO_KEY:
            dept_key = ALIAS_TO_KEY[cand_clean]
            dept_name = DEPARTMENTS[dept_key]["name"]
            break

    if not dept_name:
        dept_name = clean_base.replace('_', ' ').title()

    return dept_name, file_grade

def build_classrooms_data(all_programs):
    classrooms = {}
    for prog in all_programs.values():
        for c in prog.get("courses", []):
            room = schedule_parser.clean_classroom(c.get("classroom"))
            if not room or len(room) < 3:
                continue
            if room not in classrooms:
                classrooms[room] = []
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

def run_pipeline():
    source_dir = "kaynak_dosyalar" if os.path.exists("kaynak_dosyalar") else "."
    all_programs = {}
    total_slots = 0

    print("=== Ders Programları Ayrıştırılıyor (Koordinat Tabanlı Model) ===")
    files = sorted(os.listdir(source_dir))
    valid_exts = [".pdf", ".xlsx", ".xls", ".docx"]

    for fname in files:
        fpath = os.path.join(source_dir, fname)
        if not os.path.isfile(fpath):
            continue
        ext = os.path.splitext(fname)[1].lower()
        if ext not in valid_exts:
            continue
        if "ESAS" in fname.upper() or "YONERGE" in fname.upper():
            continue

        dept_name, file_grade = detect_dept_and_grade(fname)
        try:
            blocks = schedule_parser.parse_file(fpath)
            progs, warns = schedule_parser.blocks_to_programs(blocks, dept_name, meta_grade=file_grade)
            for grade, courses in progs.items():
                if not courses:
                    continue
                prog_key = f"{dept_name} - {grade}. Sınıf"
                if prog_key not in all_programs:
                    all_programs[prog_key] = {
                        "title": prog_key,
                        "department": dept_name,
                        "grade": grade,
                        "file": fname,
                        "courses": []
                    }
                
                # Tag courses with program key
                for c in courses:
                    c["program"] = prog_key
                    all_programs[prog_key]["courses"].append(c)
                    total_slots += 1
            print(f"[OK] {fname} -> {dept_name} ({len(progs)} sinif)")
        except Exception as e:
            print(f"[-] Hata ({fname}): {e}")

    # 1. courses_data.js
    with open("courses_data.js", "w", encoding="utf-8") as f:
        f.write("const ALL_PROGRAMS_DATA = " + json.dumps(all_programs, ensure_ascii=False, indent=2) + ";\n")

    # 2. data.js
    classrooms_data = build_classrooms_data(all_programs)
    with open("data.js", "w", encoding="utf-8") as f:
        f.write("const CLASSROOMS_DATA = " + json.dumps(classrooms_data, ensure_ascii=False, indent=2) + ";\n")

    print(f"\n[OK] ISLEM BASARIYLA TAMAMLANDI!")
    print(f"Toplam Program Sayısı: {len(all_programs)}")
    print(f"Toplam Ders Saati: {total_slots}")
    print(f"Derslik Sayısı: {len(classrooms_data)}")
    return len(all_programs), total_slots

if __name__ == "__main__":
    run_pipeline()