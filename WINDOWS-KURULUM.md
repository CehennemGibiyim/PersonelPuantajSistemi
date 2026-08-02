# Windows EXE oluşturma

Bu proje Electron ile Windows masaüstü uygulamasına dönüştürülebilir.

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

## Notlar

- Uygulama verileri Electron'un kullanıcı veri klasöründe tutulur; uygulama güncellense de korunur.
- Miniapps AI ortamı dışındaki Windows sürümünde yapay zekâ önerisi özelliği, internet/SDK bulunmadığında kullanılamaz; puantaj, nöbet, yazdırma, Excel ve JSON işlemleri yerel olarak çalışır.
- EXE oluştururken yalnızca bu proje klasörünü kullanın. `node_modules` klasörü ZIP'e dahil olmak zorunda değildir; `npm install` ile yeniden oluşturulur.
