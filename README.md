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

Sınıf ve şube bazında 08:00 - 17:00 arası haftalık ders çizelgesini responsive bir matriste sunar. Tablodaki hoca isimlerine tıklandığında doğrudan hocanın haftalık programına geçiş yapılır.

3. 👨‍🏫 Hoca Ders Programı (Öğretim Elemanı Timetable)

Tüm bölümlerden taranan 290+ öğretim elemanının haftalık ders çizelgesini gösterir.

İsimle arama ve bölüm filtresi mevcuttur.

Canlı Durum Kartı: Hocanın o an derste olup olmadığını, hangi sınıfta olduğunu veya sıradaki dersinin saatini gerçek zamanlı hesaplar.

4. 🧩 İnteraktif Ders Taslak & Çakışma Planlayıcısı

Öğrenciler almak istedikleri dersleri ve şubeleri taslak listesine ekleyebilir.

Sistem, eklenen derslerin saatlerini haftalık ızgara üzerinde simüle eder ve çakışan dersleri kırmızı alarm ve bildirimle vurgular.

5. 🔐 Üyelik & E-posta Onay Kodu (Supabase Auth)

Kullanıcılar e-posta ile üye olabilir; e-postalarına 6 haneli doğrulama kodu (OTP) iletilir.

Giriş yapan kullanıcıların ders taslakları buluta (Supabase `user_plans` tablosuna) otomatik kaydedilir ve tüm cihazlardan erişilebilir.

6. 🧩 Google Chrome Eklentisi (Manifest V3)

Tarayıcının sağ üst köşesinden tek tıkla açılan kompakt ve hızlı eklenti.

O anki saat ve günü otomatik algılayarak tek tıkla boş sınıfları ve o günkü dersleri listeler.

Seçilen bölümü tarayıcı hafızasında saklar, her açılışta tekrar arama gerektirmez.

🛠️ Teknik Mimari & Teknolojiler

| Katman | Teknoloji / Kütüphane | Kullanım Amacı |
| --- | --- | --- |
| Frontend UI | HTML5, Tailwind CSS | Modern, koyu tema odaklı ve responsive arayüz |
| Chrome Eklentisi | Manifest V3, Vanilla CSS/JS | Kompakt popup, çevrimdışı çalışma, depolama |
| İstemci Mantığı | Vanilla JavaScript (ES6+) | State yönetimi, filtreleme, hoca ayrıştırma, çakışma çözümleme |
| Kimlik & Bulut | Supabase Auth & Postgres | E-posta OTP doğrulama ve kullanıcı taslak senkronizasyonu |
| Veri Boru Hattı | Python 3, pdfplumber, openpyxl | Ham PDF ve Excel programlarından veri ayıklama |
| Dağıtım | GitHub Pages | Statik web barındırma |

🔌 Google Chrome Eklentisi Nasıl Kurulur?

1. Google Chrome veya Chromium tabanlı tarayıcınızda (Brave, Edge, Opera vb.) adres çubuğuna `chrome://extensions` yazın ve **Enter**'a basın.
2. Sağ üst köşedeki **Geliştirici Modu (Developer mode)** anahtarını açın.
3. Sol üstte beliren **Paketlenmemiş öge yükle (Load unpacked)** butonuna tıklayın.
4. Proje klasöründeki `extension` dizinini seçin.
5. Artık tarayıcınızın eklentiler menüsünden **BTÜ Kampüs Asistanı**'na tıklayarak anında boş sınıfları ve ders programınızı görebilirsiniz!

⚙️ Supabase Kurulumu (Üyelik & Onay Kodu İçin)

1. [supabase.com](https://supabase.com) adresinden ücretsiz bir proje oluşturun.
2. Supabase panelinde **SQL Editor** sekmesine gidin ve projedeki `supabase_setup.sql` dosyasının içeriğini yapıştırıp çalıştırın (`user_plans` tablosu ve RLS politikaları oluşturulur).
3. **Authentication → Providers → Email** bölümünde:
   - *Enable Email provider* aktif olsun.
   - *Confirm email* aktif olsun (üyelik onay kodu gönderilmesi için).
4. **Project Settings → API** bölümünden `Project URL` ve `anon public` anahtarını kopyalayın.
5. `supabase_config.js` dosyasına bu iki değeri yapıştırın:
   ```javascript
   window.SUPABASE_CONFIG = {
     SUPABASE_URL: "https://your-project.supabase.co",
     SUPABASE_ANON_KEY: "your-anon-key"
   };
   ```

📂 Proje Dizin Yapısı

```
btu-campus-assistant/
├── index.html            # Ana web uygulaması arayüzü ve istemci mantığı
├── extension/            # Google Chrome Eklentisi (Manifest V3)
│   ├── manifest.json     # Eklenti yapılandırması
│   ├── popup.html        # Eklenti arayüzü
│   ├── popup.css         # Eklenti karanlık tema stili
│   ├── popup.js          # Eklenti etkileşim & depolama mantığı
│   ├── icon16.png        # Eklenti simgeleri (16, 48, 128)
│   ├── courses_data.js   # Program veri seti
│   └── data.js           # Derslik veri seti
├── auth.js               # Üyelik, giriş, e-posta onay kodu ve taslak senkronizasyonu
├── supabase_config.js    # Supabase URL ve anon key yapılandırması
├── supabase_setup.sql    # Veritabanı tablo ve RLS şeması
├── data.js               # Sınıf bazlı doluluk/boşluk veri seti (CLASSROOMS_DATA)
├── courses_data.js       # Bölüm ve sınıf programları veri seti (ALL_PROGRAMS_DATA)
├── build_courses.py      # PDF ve Excel dosyalarını JS/JSON formatına çeviren Python betiği
├── classrooms_all.json   # Ham derslik verisi JSON yedeği
├── kaynak_dosyalar/      # Fakültelerden toplanan ham PDF ve Excel çizelgeleri
└── README.md             # Proje dokümantasyonu
```
