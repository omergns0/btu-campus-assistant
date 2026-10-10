🎓 BTÜ - Kampüs & Ders Yönetim Platformu

Bursa Teknik Üniversitesi (BTÜ) öğrencileri ve akademisyenleri için geliştirilmiş; gerçek zamanlı boş derslik tespiti, bölüm bazlı haftalık ders programı (timetable) görselleştirme ve interaktif ders seçim çakışma analiz platformu.

🔗 Canlı Demo: https://omergns0.github.io/btu-campus-assistant/

📌 Projenin Çözdüğü Problem

Üniversite kampüslerinde vize/final haftalarında, boş ders aralarında veya grup çalışmalarında boş amfi ve sınıf bulmak ciddi bir zaman kaybıdır. Ayrıca dönem başlarında fakültelerce karmaşık Excel/PDF tabloları halinde paylaşılan ders programları hem mobilde okunamaz durumdadır hem de çap/yan dal/alttan ders alan öğrencilerin saat çakışmalarını tespit etmesini zorlaştırır.

BTÜ Kampüs Asistanı, ham akademik verileri otomatik bir veri işleme hattından (data pipeline) geçirerek temiz ve etkileşimli bir web asistanına dönüştürür.

🚀 Öne Çıkan Modüller

1. 🏢 Boş Derslik Bulucu

Dinamik Filtreleme: Gün, başlangıç/bitiş saati, kampüs (Mimar Sinan - MS / Yıldırım Bayezid - YB) ve bina bloğu (A, B, C, E, G Blok vb.) bazında anlık arama.

Akıllı Aralık Analizi: Seçilen saat aralığında dersliğin tamamen boş olup olmadığını hesaplar; doluysa hangi saatte hangi dersin olduğunu açıkça listeler.

2. 📅 Bölüm Haftalık Ders Programı (Timetable)

Tüm mühendislik ve sosyal bilimler fakültesi programlarını tek bir açılır menüde birleştirir.

Sınıf ve şube bazında 08:00 - 17:00 arası haftalık ders çizelgesini responsive bir matriste sunar.

3. 🧩 İnteraktif Ders Taslak & Çakışma Planlayıcısı

Öğrenciler almak istedikleri dersleri ve şubeleri taslak listesine ekleyebilir.

Sistem, eklenen derslerin saatlerini haftalık ızgara üzerinde simüle eder ve dakikalar içinde çakışan dersleri kırmızı alarm ve bildirimle vurgular.

🛠️ Teknik Mimari & Teknolojiler

Katman

Teknoloji / Kütüphane

Kullanım Amacı

Frontend UI

HTML5, Tailwind CSS

Modern, koyu tema (dark mode) odaklı ve responsive arayüz

İstemci Mantığı

Vanilla JavaScript (ES6+)

State yönetimi, filtreleme algoritmaları, çakışma çözümleme

Veri Boru Hattı

Python 3, pdfplumber, openpyxl, re

Ham PDF ve Excel programlarından veri ayıklama (Parsing)

Veri Depolama

JSON / Static JS Arrays

Sıfır sunucu maliyetli, hızlı istemci taraflı veri yükleme

Dağıtım (Deployment)

GitHub Pages

Sürekli erişilebilir statik web barındırma

📂 Proje Dizin Yapısı

btu-campus-assistant/
├── index.html            # Ana web uygulaması arayüzü ve istemci mantığı
├── data.js               # Sınıf bazlı doluluk/boşluk veri seti (CLASSROOMS_DATA)
├── courses_data.js       # Bölüm ve sınıf programları veri seti (ALL_PROGRAMS_DATA)
├── build_courses.py      # PDF ve Excel dosyalarını JS/JSON formatına çeviren Python betiği
├── classrooms_all.json   # Ham derslik verisi JSON yedeği
├── kaynak_dosyalar/      # Fakültelerden toplanan ham PDF ve Excel çizelgeleri
└── README.md             # Proje dokümantasyonu
