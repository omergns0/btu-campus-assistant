# -*- coding: utf-8 -*-
"""
BTU Ders Programları Otomatik Takip ve Güncelleme Sistemi (auto_watcher.py)

1. departments.py üzerinden tüm bölümlerin resmi sitelerini tarar.
2. Bölüm ana sayfalarındaki 'Ders Programları' özel sayfalarını ve duyuruları tarar.
3. Duyuru içindeki 'erişmek için tıklayınız' ve 'depo.btu.edu.tr' bağlantılarını takip eder.
4. Yeni veya güncellenmiş PDF / Excel / Word programlarını MD5 kontrolü ile algılar.
5. Değişiklik varsa kaynak_dosyalar klasörüne indirir ve build_courses.run_pipeline()'ı tetikler.
"""

import os
import re
import sys
import io
import json
import hashlib
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

from departments import DEPARTMENTS
import build_courses

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

DOWNLOAD_DIR = "kaynak_dosyalar"
HASH_FILE = "file_hashes.json"
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
VALID_EXTS = [".pdf", ".xlsx", ".xls", ".docx"]

def get_file_hash(content):
    return hashlib.md5(content).hexdigest()

def load_hashes():
    if os.path.exists(HASH_FILE):
        try:
            with open(HASH_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_hashes(hashes):
    with open(HASH_FILE, "w", encoding="utf-8") as f:
        json.dump(hashes, f, indent=2, ensure_ascii=False)

def is_schedule_text(text):
    t = (text or "").lower().replace("ı", "i").replace("ğ", "g").replace("ü", "u").replace("ş", "s").replace("ö", "o").replace("ç", "c")
    return any(k in t for k in [
        "ders program", "haftalik program", "ders cizelge", "timetable",
        "lisans ders program", "guz donemi lisans", "bahar donemi lisans"
    ])

def extract_links_from_page(soup, base_url):
    file_links = []
    page_links = []
    
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith("#") or href.startswith("javascript:"):
            continue
        full_url = urljoin(base_url, href)
        parsed = urlparse(full_url)
        path = parsed.path
        ext = os.path.splitext(path)[1].lower()
        text = a.get_text(" ", strip=True) + " " + href
        
        if ext in VALID_EXTS or "depo.btu.edu.tr" in full_url:
            parent = a.find_parent(["p", "li", "td", "div"])
            ctx = parent.get_text(" ", strip=True) if parent else ""
            file_links.append((full_url, text + " " + ctx))
        elif is_schedule_text(text) and "btu.edu.tr" in full_url:
            page_links.append(full_url)
            
    return file_links, page_links

def scan_department(dept_key, dept_info):
    base_url = dept_info.get("url")
    if not base_url:
        return []
    
    clean_base = base_url.rstrip("/")
    target_urls = [
        clean_base,
        f"{clean_base}/duyurular",
        f"{clean_base}/duyuru"
    ]
    
    discovered_files = []
    visited_pages = set()
    
    for page_url in target_urls:
        if page_url in visited_pages: continue
        visited_pages.add(page_url)
        try:
            resp = requests.get(page_url, headers=HEADERS, timeout=8)
            if resp.status_code != 200: continue
            soup = BeautifulSoup(resp.text, "html.parser")
            files, subs = extract_links_from_page(soup, page_url)
            discovered_files.extend(files)
            
            # Follow announcement or schedule pages (1-2 levels)
            for sub_url in subs[:6]:
                if sub_url not in visited_pages:
                    visited_pages.add(sub_url)
                    try:
                        sub_resp = requests.get(sub_url, headers=HEADERS, timeout=8)
                        if sub_resp.status_code == 200:
                            sub_soup = BeautifulSoup(sub_resp.text, "html.parser")
                            sub_files, sub_subs = extract_links_from_page(sub_soup, sub_url)
                            discovered_files.extend(sub_files)
                            for s2 in sub_subs[:3]:
                                if s2 not in visited_pages and ("ders-program" in s2 or "ders_program" in s2):
                                    visited_pages.add(s2)
                                    s2_resp = requests.get(s2, headers=HEADERS, timeout=8)
                                    if s2_resp.status_code == 200:
                                        s2_soup = BeautifulSoup(s2_resp.text, "html.parser")
                                        s2_files, _ = extract_links_from_page(s2_soup, s2)
                                        discovered_files.extend(s2_files)
                    except Exception:
                        pass
        except Exception:
            pass
            
    valid_schedule_files = []
    for furl, ctx in discovered_files:
        path = urlparse(furl).path
        ext = os.path.splitext(path)[1].lower()
        if ext not in VALID_EXTS and not furl.endswith(".pdf"):
            continue
        if any(bad in furl.upper() for bad in ["ESAS", "YONERGE", "LOGOS", "RAPOR"]):
            continue
        if is_schedule_text(ctx) or is_schedule_text(path) or "ders" in furl.lower():
            valid_schedule_files.append((furl, ctx))
            
    return valid_schedule_files

def check_and_update():
    stored_hashes = load_hashes()
    updated_files = []
    
    print("=== BTÜ Bölümleri ve Duyuruları Taranıyor ===")
    for dept_key, info in DEPARTMENTS.items():
        if not info.get("url"): continue
        print(f"[*] Taranıyor: {info['name']} ({dept_key})...")
        schedules = scan_department(dept_key, info)
        
        for furl, ctx in schedules:
            raw_name = os.path.basename(urlparse(furl).path)
            # Detect grade from context if present (e.g. 1.sınıf ders programı)
            m_g = re.search(r'([1-4])\s*\.?\s*s[ıi]n[ıi]f', ctx, re.I)
            if m_g:
                fname = f"{dept_key}_{m_g.group(1)}.pdf"
            else:
                fname = f"{dept_key}_{raw_name}"
                
            try:
                f_resp = requests.get(furl, headers=HEADERS, timeout=12)
                if f_resp.status_code == 200:
                    cur_hash = get_file_hash(f_resp.content)
                    if stored_hashes.get(fname) != cur_hash:
                        target_path = os.path.join(DOWNLOAD_DIR, fname)
                        with open(target_path, "wb") as f:
                            f.write(f_resp.content)
                        stored_hashes[fname] = cur_hash
                        updated_files.append(fname)
                        print(f"  [+] Yeni/Güncel Program İndirildi: {fname}")
            except Exception:
                pass
                
    save_hashes(stored_hashes)
    if updated_files:
        print(f"\n[!] {len(updated_files)} yeni/güncellenmiş dosya bulundu. Platform derleniyor...")
        build_courses.run_pipeline()
    else:
        print("\n[-] Tüm ders programları güncel, yeni değişiklik yok.")

if __name__ == "__main__":
    check_and_update()