# 🎓 BTÜ Mobil Asistan (React Native & Expo)

Bursa Teknik Üniversitesi (BTÜ) öğrencileri ve akademisyenleri için geliştirilmiş; tüm web platformu özelliklerini cebinize getiren yerel (native) Expo mobil uygulaması.

---

## 📱 Telefonunuzda Nasıl Test Edersiniz? (Expo Go)

1. Telefonunuza **Expo Go** uygulamasını yükleyin:
   - [Android için Google Play Store'dan İndir](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - [iPhone (iOS) için App Store'dan İndir](https://apps.apple.com/app/expo-go/id982107779)

2. Bilgisayarınızda terminali açıp `mobile` klasörüne girin ve bağımlılıkları kurun:
   ```bash
   cd mobile
   npm install
   ```

   **Yapay zeka anahtarı:** `.env.example` dosyasını `.env.local` adıyla kopyalayıp
   `EXPO_PUBLIC_GEMINI_API_KEY` değerini girin. Bu dosya git'e eklenmez; anahtar
   tanımlı değilse asistan yerel veri tabanından yanıt verir.

   **Veriyi güncellemek:** Kök klasörde `node export_data.js` çalıştırınca web
   sitesindeki güncel ders/derslik/sınav verisi `src/data/` içine aktarılır
   (GitHub Actions bunu her taramada otomatik yapar).

3. Expo geliştirici sunucusunu başlatın:
   ```bash
   npx expo start
   ```
   *(Alternatif olarak tünel modu için `npx expo start --tunnel` kullanabilirsiniz)*

4. Terminalde ekrana bir **QR Kod** gelecektir:
   - **Android**: Expo Go uygulamasını açıp **"Scan QR Code"** butonuna dokunun ve terminaldeki QR kodu okutun.
   - **iPhone (iOS)**: Telefonun normal Kamera uygulamasını açıp terminaldeki QR koda tutun ve beliren "Expo Go ile Aç" bildirimine dokunun.

5. Uygulama birkaç saniye içinde telefonunuza yüklenecek ve canlı olarak çalışacaktır! Kodlarda yapacağınız her değişiklik anında telefonunuzda yenilenir (Fast Refresh).

---

## 🆕 v1.1 Yenilikleri

- **Sınavlarım:** Taslağa eklenen derslerin yaklaşan sınavları Sınavlar sekmesinde geri sayımla listelenir; ☆ ile "Bölümüm" seçilebilir.
- **Boş Derslik:** Blok filtresi, "⚡ Şimdi" kısayolu, 17:00 sonrası saatler; uzaktan eğitim/ofis gibi derslik olmayan kayıtlar ayıklandı.
- **Ders Programı:** Art arda saatler tek kartta (08:00–09:45), son seçilen bölüm hatırlanır.
- **Hoca Programı:** Web ile aynı isim ayrıştırıcı (295 öğretim elemanı), aynı dersin farklı programlarda tekrar sayılması düzeltildi, hafta sonu "şu an derste" hatası giderildi.
- **Taslak:** Silme onayı, tümünü temizle, ders araması, çakışan saatlerin vurgulanması.
- **AI Asistan:** Sohbet geçmişi modele gönderilir, **kalın** yazılar biçimlenir, anahtar URL yerine başlıkta gönderilir.
- Android'de alt gezinme çubuğuyla çakışan sekme çubuğu ve adaptif uygulama ikonu düzeltildi.

## 🚀 Öne Çıkan Modüller

### 1. 🏢 Boş Derslik Bulucu (`EmptyClassroomsScreen`)
- **Dinamik Filtreleme**: Gün, saat aralığı (08:00 - 17:00), kampüs (Mimar Sinan / Yıldırım) ve bina bloğu (A, B, C, E, G Blok, Amfiler, Lablar) bazında anlık arama.
- **Akıllı Çakışma Analizi**: Sınıfın seçilen zaman aralığında tamamen boş olup olmadığını gerçek zamanlı hesaplar; doluysa hangi saatte hangi dersin olduğunu açıkça listeler.

### 2. 📅 Bölüm Haftalık Ders Programı (`TimetableScreen`)
- 102 adet mühendislik ve sosyal bilimler programının tamamı arama menüsünde birleştirilmiştir.
- Gün gün saatlik çizelge kartları, ders kodu, şube, amfi ve seçmeli/zorunlu durumları.
- Hoca ismine tek dokunuşla doğrudan hocanın haftalık ders programına geçiş.

### 3. 👨‍🏫 Hoca Ders Programı (`InstructorScreen`)
- 290+ öğretim elemanının haftalık ders çizelgesi.
- **Canlı Durum Kartı**: Hocanın o an derste olup olmadığını, hangi sınıfta olduğunu veya sıradaki dersinin saatini hesaplar.

### 4. 🧩 İnteraktif Ders Taslak & Çakışma Planlayıcısı (`PlannerScreen`)
- Öğrenciler almak istedikleri dersleri ve şubeleri taslak listesine ekleyebilir.
- **Akıllı Çakışma Denetimi**: Aynı saatteki dersleri tespit eder ve kırmızı alarm verir.
- **Devam Muafiyeti Desteği**: Alttan alınan dersler için devam muafiyeti anahtarı aktif edildiğinde çakışma uyarısı vermez.
- Eklenen tüm dersler cihaz hafızasında (`AsyncStorage`) kalıcı olarak saklanır.

### 5. 📝 Sınav Takvimi (`ExamsScreen`)
- 32 bölümün güncel vize ve final sınav programları.
- Anlık geri sayım rozetleri ("X gün kaldı", "Yarın", "Bugün").
- Resmi PDF ve duyuru bağlantıları.

### 6. 🤖 Kampüs AI Asistanı (`AiAssistantScreen`)
- Google Gemini entegrasyonlu yapay zeka sohbet robotu.
- BTÜ veri tabanı bağlamıyla eğitilmiş yanıt motoru.
- Çevrimdışı / kota aşımı durumunda akıllı yerel yanıt motoru.

---

## 🛠️ Proje Yapısı

```
mobile/
├── App.js                     # Kök uygulama ve tema yapılandırması
├── app.json                   # Expo ve cihaz metadata ayarları
├── assets/                    # BTÜ logoları ve simgeleri
└── src/
    ├── config/appConfig.js    # API anahtarları ve servis yapılandırması
    ├── theme/colors.js        # Modern koyu tema paleti ve sabitler
    ├── utils/helpers.js       # Derslik ve zaman ayrıştırma fonksiyonları
    ├── services/
    │   ├── aiService.js       # Gemini API & Kampüs sorgu motoru
    │   └── storageService.js  # AsyncStorage kalıcı yerel veri servisi
    ├── screens/
    │   ├── EmptyClassroomsScreen.js
    │   ├── TimetableScreen.js
    │   ├── InstructorScreen.js
    │   ├── PlannerScreen.js
    │   ├── ExamsScreen.js
    │   └── AiAssistantScreen.js
    ├── navigation/
    │   └── AppNavigator.js    # 6 sekmeli Bottom Tab Bar
    └── data/
        ├── classrooms.json    # 244 dersliğin haftalık doluluk verileri
        ├── programs.json      # 102 bölüm programı
        └── exams.json         # 32 bölümün sınav takvimleri
```
