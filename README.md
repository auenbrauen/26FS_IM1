# 26FS_IM1

# Fischerguide

## Team

* Lino Fiechter
* Aaron Sägesser

## Kurzbeschreibung

Der Fischerguide zeigt, ob die Bedingungen gerade gut zum Angeln sind. Die Website ruft aktuelle Messdaten für den Bielersee, Brienzersee und Thunersee ab und zeigt an, welche Fische bei den aktuellen Bedingungen beissen und welche Köder man verwenden soll. Die Daten werden automatisch alle 5 Minuten aktualisiert.

## Learnings

Ich habe gelernt, wie man Daten von einer externen API abruft und im Browser weiterverarbeitet. Neu war für uns auch, wie man mehrere API-Anfragen gleichzeitig startet und die Ergebnisse zusammenführt. Ausserdem haben wir geübt, den HTML-Inhalt einer Seite dynamisch per JavaScript zu verändern.

## Schwierigkeiten

Die zwei APIs (Hydro und SMN) liefern ihre Daten in unterschiedlichen Formaten. Es hat einige Zeit gebraucht, die richtigen Standortcodes und Parameternamen für jeden See herauszufinden. Auch das Layout war anspruchsvoll, weil es je nach Anzahl der passenden Fische anders aussehen muss.

## Known Bugs

Für den Brienzersee gibt es keinen Trübheitswert. Das liegt daran, dass die Messstation keinen Wert dafür liefert – das kann nicht behoben werden.

## Ressourcen

* [Claude](https://claude.ai/)
* Coachings bei Dozenten