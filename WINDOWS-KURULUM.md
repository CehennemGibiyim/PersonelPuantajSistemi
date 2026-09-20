# Windows EXE oluşturma

Bu proje Electron ile Windows masaüstü uygulamasına dönüştürülebilir. Uygulama, işletim sisteminin standart pencere çerçevesi olmadan açılır ve kendi başlık çubuğunu kullanır.

## Gereksinimler

- Windows 10 veya Windows 11
- Node.js LTS: https://nodejs.org/
- Proje klasörünün tamamı

## Geliştirme modunda çalıştırma

PowerShell veya Komut İstemi'ni proje klasöründe açın:

```bash
npm install
npm start
```

`npm start` komutu çalışırken komut penceresini kapatmayın. Electron penceresi ayrı bir masaüstü penceresi olarak açılır. Güncel ZIP'i kullanırken eski proje klasörünün üzerine kopyalamayın; ZIP'i tamamen yeni ve boş bir klasöre çıkarın. Başlangıçta terminalde `[Electron] Başlatılıyor:` ve ardından `[Electron] index.html başarıyla yüklendi.` satırlarını görmelisiniz. Pencere açılmazsa aşağıdaki sorun giderme adımlarını uygulayın.

## Çerçevesiz pencere ve tema desteği

Electron penceresi `electron-main.cjs` içinde `frame: false`, `thickFrame: false` ve `roundedCorners: false` ile yapılandırılmıştır. Bu nedenle Windows'un standart başlık, kenarlık ve kapatma çubuğu görünmez.

Uygulamanın kendi başlık çubuğu `index.html` içinde yer alır ve şu işlemleri destekler:

- Pencereyi sürükleme
- Küçültme
- Büyütme veya eski boyuta döndürme
- Kapatma
- Başlık çubuğuna çift tıklayarak büyütme/küçültme

Uygulama sabit koyu tema ile çalışır; Windows'un açık/koyu tema tercihi arayüzü değiştirmez. `desktop-window.css` uygulamanın çerçevesiz pencere görünümünü düzenler.

Windows'ta bazı ekran kartı sürücüleri Electron açılırken geçici bir GPU uyarısı yazabilir. `electron-main.cjs` Windows için donanım hızlandırmasını güvenli biçimde devre dışı bıraktığı için bu uyarının uygulamayı kapatması engellenir.

Sol kenar menüsü uygulamanın iç navigasyonudur; işletim sistemi pencere çerçevesinden ayrı çalışır. Menü bölümleri ilk açılışta kapalıdır ve kullanıcı yalnızca ihtiyaç duyduğu bölümü açar.

## `npm start` ile pencere açılmazsa

Önce proje klasöründe şu komutları sırasıyla çalıştırın:

```bash
rmdir /s /q node_modules
npm install
npm start
```

PowerShell kullanıyorsanız ilk komut yerine şu komutu kullanabilirsiniz:

```powershell
Remove-Item -Recurse -Force node_modules
npm install
npm start
```

`npm install` sırasında görülen `deprecated` paket mesajları uyarıdır; tek başına uygulamanın açılmasını engellemez. `2 high severity vulnerabilities` mesajı da kurulumun başarısız olduğu anlamına gelmez. Kurulumdan sonra pencere yine açılmazsa terminalde görünen ilk `[Electron]` veya `[Renderer]` hata satırını kontrol edin.

Electron kurulum betikleri için npm izin uyarısı verirse Electron dosyalarının gerçekten kurulduğundan emin olmak için önce izin verin, ardından yeniden oluşturun:

```bash
npm install-scripts approve electron electron-winstaller
npm rebuild electron
npm start
```

Bu komut npm sürümünüzde tanınmıyorsa izin uyarısını geçip `npm rebuild electron` komutunu deneyin. Electron penceresi yine açılmazsa `npm install` işlemini yönetici olmayan normal bir kullanıcı terminalinde, internet bağlantısı açıkken yeniden çalıştırın.

GPU ile ilgili `ContextResult::kTransientFailure` satırı tek başına kritik hata değildir. Bu proje Windows'ta donanım hızlandırmasını ve GPU kullanımını kapatır; buna rağmen pencere açılmazsa `node_modules` klasörünü silip `npm install` komutunu yeniden çalıştırın.

Açılış sırasında pencere görünmezse terminalde şu satırları kontrol edin:

- `[Electron] index.html başarıyla yüklendi.`: HTML dosyası yüklenmiştir.
- `[Electron] Arayüz penceresi hazır.`: Pencere gösterilmiştir.
- `[Renderer] ...`: Arayüz JavaScript'inde hata vardır.
- `[Electron] Renderer kapandı`: Renderer süreci kapanmıştır.

Arayüz JavaScript'i başlatılamazsa pencere artık tamamen boş kalmaz; `Uygulama arayüzü başlatılamadı` başlıklı bir tanı paneli gösterir. Bu paneldeki hata metni ve terminaldeki `[Renderer]` satırı sorunun bulunması için kullanılmalıdır. `boot-diagnostics.js` dosyasının da proje klasöründe bulunduğundan emin olun.

Electron'un geliştirme modundaki güvenlik uyarısı uygulamanın açılmasını engellemez. Bu uyarı yalnızca `index.html` dosyasında Content-Security-Policy tanımı bulunmadığını belirtir; paketlenmiş sürümde gösterilmez. Proje dosyalarını tek tek farklı sürümlerden birleştirmeyin.

## Kurulum EXE'si oluşturma

```bash
npm run dist
```

Oluşan dosyalar `release` klasörüne yazılır. NSIS kurulumu şu özelliklere sahiptir:

- Windows'a normal program gibi kurulur.
- Masaüstü kısayolu oluşturur.
- Başlat menüsü kısayolu oluşturur.
- Kurulum klasörü seçilebilir.
- Veriler kullanıcı profilinde saklanır.

## Taşınabilir EXE

Kurulum gerektirmeyen tek dosya için:

```bash
npm run dist:portable
```

## Kurulum paketi hazırlamadan önce

1. Projenin en güncel dosyalarının tamamını indirin.
2. ZIP arşivini tamamen yeni bir klasöre çıkarın.
3. PowerShell'i bu klasörde açın.
4. `npm install` komutunu çalıştırın.
5. Geliştirme sürümünü `npm start` ile kontrol edin.
6. Kurulum paketini `npm run dist` ile oluşturun.

Eksik dosyalı veya eski bir klasörden paket oluşturmayın. Özellikle `electron-main.cjs`, `electron-preload.cjs`, `desktop-window.css`, `index.html` ve `package.json` dosyalarının aynı proje sürümüne ait olduğundan emin olun.

## Veriler ve sınırlamalar

- Uygulama verileri Electron'un kullanıcı veri klasöründe tutulur; uygulama güncellense de korunur.
- Windows sürümünde yapay zekâ önerisi özelliği internet ve Miniapps AI SDK erişimi olmadığında kullanılamaz.
- Puantaj, nöbet, yazdırma, Excel ve JSON işlemleri yerel olarak çalışır.
- EXE oluştururken yalnızca güncel proje klasörünü kullanın. `node_modules` klasörünü ZIP'e dahil etmek zorunlu değildir; `npm install` ile yeniden oluşturulur.
