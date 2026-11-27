# ReqIF Web Viewer

[English](README.md) · [简体中文](README.zh-CN.md) · **Deutsch**

Ein schreibgeschützter Viewer für lokale ReqIF- und ReqIFz-Dateien. Lesen und durchsuchen Sie Anforderungen und vergleichen Sie zwei Versionen im Browser.

[Viewer öffnen](https://xzeng666.github.io/reqif-web-viewer/) · [Projektübersicht](https://xzeng666.github.io/projects/reqif-web-viewer/)

## Datei öffnen

Klicken Sie auf **Datei öffnen** oder ziehen Sie eine Datei auf die Seite. Für die Offline-Nutzung entpacken Sie den Quellcode und öffnen `index.html` in einem aktuellen Browser.

- Lesen Sie Spezifikationen in der Dokumentansicht oder öffnen Sie einzelne Arbeitselemente, um Attribute und Verknüpfungen zu prüfen.
- Suchen Sie nach ID, Titel oder Inhalt. Mit **Vorheriger Treffer** und **Nächster Treffer** springen Sie durch die Texttreffer. Filterwerte desselben Dropdowns werden mit ODER verknüpft, verschiedene Felder mit UND.
- Über das Zahnrad im Arbeitselement wählen Sie sichtbare Felder und ändern deren Reihenfolge. Die Attributtabelle kennzeichnet geerbte Standardwerte und behält die Zeitzonen der Quelldatei bei.
- Bilder lassen sich zoomen und verschieben. Breite Tabellen können Sie horizontal scrollen und Anhänge aus dem Archiv herunterladen. Die Statistik unten links zählt jedes Arbeitselement der Quelldatei einmal, auch bei Verweisen aus mehreren Spezifikationen.

## Versionen vergleichen

Klicken Sie auf **Versionen vergleichen** und wählen Sie die alte und die neue Datei. Ist bereits eine Datei geöffnet, übernimmt der Eintrag unten rechts sie als neue Version. Öffnen Sie ein Arbeitselement, um die Änderungen nebeneinander zu sehen, oder filtern Sie über die Zähler unten nach Status. Unter **Vergleichsaktionen** können Sie eine CSV-Datei oder einen offline lesbaren HTML-Bericht exportieren.

Die Zuordnung erfolgt über eine eindeutige `ReqIF.ForeignID`. Fehlt sie, dient `IDENTIFIER` als Ersatz. Verglichen werden Titel, Text und gemeinsame Attribute. Arbeitselemente, die nur in der alten Datei vorkommen, wurden möglicherweise entfernt oder beim neueren Export ausgelassen.

## Lokale Verarbeitung

Einlesen, Suche, Vergleich und Export laufen im Browser. Dateien bleiben auf dem Gerät. Externe Ressourcen aus Dokumenten werden nicht automatisch geladen.

## Unterstützte Dateien

- ReqIF unterstützt Zeichenketten, Rich-Text, Aufzählungen, Ganzzahlen, reelle Zahlen, boolesche Werte und Datumswerte.
- ReqIFz enthält eine ReqIF-Datei und optional Anhänge. Für Deflate-Archive muss der Browser `DecompressionStream` mit `deflate-raw` unterstützen.
- Maximal 512 MiB pro Datei, 200 MiB für die XML-Datei und 500 MiB für den entpackten Archivinhalt.

## Quellcode

| Datei | Zweck |
| --- | --- |
| `index.html`, `static/style.css` | Seite und Darstellung |
| `static/app.js`, `static/search.js`, `static/attributes.js`, `static/media.js` | Bedienoberfläche |
| `static/reqif.js`, `static/zip.js` | Dateien einlesen |
| `static/compare.js`, `static/compare-view.js` | Zuordnung, Anzeige und Export von Versionsunterschieden |

## Lizenz

[MIT](LICENSE). Siehe auch die [Lizenzen des mitgelieferten Parsers](static/vendor/LICENSE.txt).
