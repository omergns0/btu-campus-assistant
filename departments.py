# -*- coding: utf-8 -*-
"""
Bölüm yapılandırması (tek kaynak).

key        : Kısa, ASCII bölüm anahtarı (indirilen dosya adlarında kullanılır)
name       : Sitede gösterilecek kanonik bölüm adı
url        : Bölümün BTÜ web sayfası (tarayıcı buradan başlar)
aliases    : Elle eklenmiş eski dosya adlarının önekleri (ör. pc_1.pdf -> "pc")
"""

DEPARTMENTS = {
    # --- Mühendislik ve Doğa Bilimleri Fakültesi ---
    "bilgisayar":   {"name": "Bilgisayar Mühendisliği", "url": "https://mdbf.btu.edu.tr/tr/bilgisayar", "aliases": ["pc", "bm", "bilgisayar"]},
    "biyomuh":      {"name": "Biyomühendislik", "url": "https://mdbf.btu.edu.tr/tr/biyomuh", "aliases": ["biyomuhendis", "biyomühendis", "biyomuh"]},
    "cevre":        {"name": "Çevre Mühendisliği", "url": "https://mdbf.btu.edu.tr/tr/cevre", "aliases": ["cevre", "cevre_muhendis", "çevre_mühendis"]},
    "insaat":       {"name": "İnşaat Mühendisliği", "url": "https://mdbf.btu.edu.tr/tr/insaat", "aliases": ["insaat", "inşaat"]},
    "gida":         {"name": "Gıda Mühendisliği", "url": "https://mdbf.btu.edu.tr/tr/gida", "aliases": ["gida", "gıda", "gida_muh", "gıda_müh"]},
    "fizik":        {"name": "Fizik", "url": "https://mdbf.btu.edu.tr/tr/fizik", "aliases": ["fizik"]},
    "endustri":     {"name": "Endüstri Mühendisliği", "url": "https://mdbf.btu.edu.tr/tr/endustri", "aliases": ["endustri", "endüstri"]},
    "elektrik":     {"name": "Elektrik-Elektronik Mühendisliği", "url": "https://mdbf.btu.edu.tr/tr/elektrik", "aliases": ["eem", "elektrik"]},
    "kimya":        {"name": "Kimya", "url": "https://mdbf.btu.edu.tr/tr/kimya", "aliases": ["kimya"]},
    "kimyamuh":     {"name": "Kimya Mühendisliği", "url": "https://mdbf.btu.edu.tr/tr/kimyamuh", "aliases": ["kimyamuh", "kimyamüh"]},
    "makine":       {"name": "Makine Mühendisliği", "url": "https://mdbf.btu.edu.tr/tr/makine", "aliases": ["makine"]},
    "matematik":    {"name": "Matematik", "url": "https://mdbf.btu.edu.tr/tr/matematik", "aliases": ["matematik"]},
    "mekatronik":   {"name": "Mekatronik Mühendisliği", "url": "https://mdbf.btu.edu.tr/tr/mekatronik", "aliases": ["mekatronik"]},
    "mekatroniking": {"name": "Mekatronik Mühendisliği (İngilizce)", "url": None, "aliases": ["mekatroniking"]},
    "metalurji":    {"name": "Metalurji ve Malzeme Mühendisliği", "url": "https://mdbf.btu.edu.tr/tr/metalurji", "aliases": ["meta_malzeme", "metalurji"]},
    "polimer":      {"name": "Polimer Malzeme Mühendisliği", "url": "https://mdbf.btu.edu.tr/tr/polimer", "aliases": ["polimer"]},
    "veribilimi":   {"name": "Veri Bilimi ve Analitiği", "url": "https://mdbf.btu.edu.tr/tr/veribilimi", "aliases": ["veri", "veribilimi"]},
    "yapayzeka":    {"name": "Yapay Zeka ve Makine Öğrenmesi", "url": "https://mdbf.btu.edu.tr/tr/yapayzeka", "aliases": ["yapayzeka"]},
    # --- İnsan ve Toplum Bilimleri Fakültesi ---
    "sosyoloji":    {"name": "Sosyoloji", "url": "https://itbf.btu.edu.tr/tr/sosyoloji", "aliases": ["sosyoloji"]},
    "ui":           {"name": "Uluslararası İlişkiler", "url": "https://itbf.btu.edu.tr/tr/ui", "aliases": ["uluslariliski"]},
    "ui_ing":       {"name": "Uluslararası İlişkiler (İngilizce)", "url": None, "aliases": ["uluslariliski_ing"]},
    "utl":          {"name": "Uluslararası Ticaret ve Lojistik", "url": "https://itbf.btu.edu.tr/tr/utl", "aliases": ["utl"]},
    "isletme":      {"name": "İşletme", "url": "https://itbf.btu.edu.tr/tr/business", "aliases": ["isletme", "i̇sletme", "business"]},
    "imtb":         {"name": "Mütercim ve Tercümanlık", "url": "https://itbf.btu.edu.tr/tr/imtb", "aliases": ["mutercim_ve_tercumanlik", "mütercim_ve_tercümanlık"]},
    "psikoloji":    {"name": "Psikoloji", "url": "https://itbf.btu.edu.tr/tr/psikoloji", "aliases": ["psikoloji"]},
    # --- Mimarlık ve Tasarım Fakültesi ---
    "mimarlik":     {"name": "Mimarlık", "url": "https://mtf.btu.edu.tr/tr/mimarlik", "aliases": ["mimarlik"]},
    "sehir":        {"name": "Şehir ve Bölge Planlama", "url": "https://mtf.btu.edu.tr/tr/sehir", "aliases": ["sehir"]},
    "peyzaj":       {"name": "Peyzaj Mimarlığı", "url": "https://mtf.btu.edu.tr/tr/peyzaj", "aliases": ["peyzaj", "pm"]},
    # --- Orman Fakültesi ---
    "ormanendustri": {"name": "Orman Endüstri Mühendisliği", "url": "https://of.btu.edu.tr/ormanendustri", "aliases": ["orman_endustri", "orman_endüstri"]},
    "orman":        {"name": "Orman Mühendisliği", "url": "https://of.btu.edu.tr/orman", "aliases": ["orman_muhendisligi", "orman_mühendisliği"]},
    # --- Denizcilik Fakültesi ---
    "diy":          {"name": "Denizcilik İşletmeleri Yönetimi", "url": "https://df.btu.edu.tr/tr/diy", "aliases": ["denizcilik_isletmeleri"]},
    "gigm":         {"name": "Gemi İnşaatı ve Gemi Makineleri Mühendisliği", "url": "https://df.btu.edu.tr/tr/gigm", "aliases": ["gemi", "gemiinsaati", "gemiinşaatı"]},
}


def _alias_index():
    idx = {}
    for key, d in DEPARTMENTS.items():
        idx[key] = key
        for a in d.get("aliases", []):
            idx[a] = key
    return idx


ALIAS_TO_KEY = _alias_index()
