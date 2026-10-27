# etoxd – ETO Játékosportál (demó)

Statikus demó az ETO játékosportálhoz: bejelentkezés, edzésekre be- és kilépés, visszajelzés az edzések végén, edzői és admin nézet.
Nincs backend: minden adat a böngészőben (localStorage) tárolódik.

## Futtatás

```bash
python3 -m http.server 8000
# majd: http://localhost:8000
```

(Az `index.html` közvetlen megnyitása is működik, de az Excel-feltöltéshez és a betűtípusokhoz jobb a helyi szerver.)

## Demó felhasználók

Jelszó mindenkinek: `eto1904`. A belépés a TalentX azonosítóval történik.

| Szerepkör | TalentX | Név |
|-----------|---------|-----|
| Játékos   | TX-1001 | Kiss Bence (U17) |
| Edző      | TX-2001 | Nagy Péter (U17) |
| Edző      | TX-2002 | Szabó Anna (U19) |
| Admin     | TX-9001 | Kovács Eszter |

A bejelentkező oldalon a „Játékos / Edző / Admin” gombokkal egy kattintással be lehet lépni.

## Mit tud a demó

- **Játékos**: látja a csapata edzéseit napokra bontva. Az edzés kezdete előtt 15 perccel nyílik a belépés,
  az edzés alatt ki is léphet. Ha jelen volt, az edzés után este 22:00-ig visszajelzést küldhet csúszkás
  kérdésekkel (hangulat-arc, terhelés, saját teljesítmény), opcionális megjegyzéssel, névvel vagy névtelenül.
- **Edző**: a saját csapata edzéseinél látja, ki lépett be és mikor, és az érkezett visszajelzéseket (átlagok és megjegyzések).
- **Admin**: ugyanez minden csapatra, plusz felhasználókezelés (ki léphet be) és a heti beosztás feltöltése
  (.xlsx vagy .csv; minta letölthető az oldalon). A feltöltés felülírja az azonos napra és csapatra vonatkozó edzéseket.

A demó edzései az aktuális időponthoz igazodnak (van épp zajló, nemrég véget ért és későbbi edzés is),
és naponta, illetve 6 óránként újragenerálódnak. Az oldal alján a „Demó visszaállítása” gomb is újrakezdi.

## Fájlok

- `index.html`, `styles.css`, `script.js`: bejelentkezés
- `app.html`, `app.css`, `app.js`: portál (játékos / edző / admin nézet)
- `data.js`: demó adatok és tárolás
- `public/assets/`: címer és betűtípusok

## Betűtípusok

A `public/assets/fonts/` mappába kell tenni:

- `futura-display-xbd.otf`
- `futura-display-bold.otf`
- `futura-pt-book.otf`

Amíg nincsenek ott, a felület tartalék betűtípust használ.
