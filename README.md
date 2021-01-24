# Soziale Medien und Emotionen

Ein medial inszeniertes Projekt über die Alltagskultur im Netz,
basierend auf der Technik des Netzes.

Ziel ist es zu sehen, wie die Stimmung im Netz ist:
Ist eine Plattform verglichen mit anderen "wütender"?
Kann man die Stimmung im Netz nach bestimmten Ereignissen sehen?
Lässt sich auf den Plattformen insgesammt Zorn und Wut beobachten?
(wie es teilweise den Social Media Giganten nachgesagt wird)

Wie soll dies geschehen:
Im Projekt werden die "Posts" bzw. Social Media Beiträge möglichst "live" geladen.

Live bezeichnet hierbei nicht wesentlich älter als eine Minute seit der Veröffentlichung.
Spätestens nach 1 oder 2 Minuten kann man nicht mehr von "live" sprechen. 
Wirklich "sofort" können Beiträge zum Teil aus technischen Gründen nicht abgerufen werden.

Die Beiträge stammen von unterschiedlichen Plattformen.
Geplant sind vorerst:
- Twitter
- 4Chan
- Reddit (?)
Ggf. ergänzt werden können noch Youtube-Kommentare, Facebook-Posts und andere Netzwerke.
Hierbei liegt dann besonderer Augenmerk, ob die Plattform für Fake-News, Hetze oder ähnliches bekannt geworden ist.

# Struktur und Funktionsweise
Das Projekt selbst nutzt Node, also Javascript.
Um aber unterschiedlichen Entwicklern die Arbeit in ihrer Programmiersprache zu erleichtern,
können die Plattform-Module in jeder Programmiersprache geschrieben werden.
Diese Module werden als Sub-Prozess aufgerufen.
Hierzu ist folgendes notwendig:
- Das Modul ist ein Verzeichnis unter /data_gatherers (Name des Verzeichnis frei wählbar)
- Das Modul arbeitet auf englischsprachigen Beiträgen 
(sofern sich dies bewerkstelligen lässt - ist die Plattformsprache überwiegend Englisch und keine Sprachselektion ist möglich, ist dies auch ok)
- Ein Textfile start.txt enthält den Befehl, 
der den Prozess auf der Kommandozeile starten würde
- dieses Textfile ist auf oberster Ebene im Modul
- der Prozess schreibt gefundene, neue Beiträge nach stdout, 
das Format ist heirbei ein JSON-Objekt mit den Feldern timestamp, platform, text, originalText.
Text ist der Original-Text, befreit von Links, Plattform-spezifischen Kontroll-Informationen (Username-Erwähnungen, Tags u.ä.).
Die Id muss nur für die Plattform einzigartig sein. Es kann entweder die auf der Platform verwendete ID sein, 
oder eine eigens generierte UUID, falls keine solche vorhanden ist.
Ein Beispiel für einen Post (mit zensierten (User-)Namen):
```
{"platform":"twitter","timestamp":"2021-01-24T22:53:02.914Z","id":"1353475887765876736","username":"***","account":"***","text":"OH GOD HE IS SO SWEET!","originalText":"RT @***: OH GOD HE IS SO SWEET!"}
```
Dieser sollte als eine Zeile von einem Programm in data_gatherers ausgegeben werden.

Die Beiträge der einzelnen Platformen werden von den jeweiligen Prozessen an die Hauptanwendung geleitet.
Diese gibt sie an ein Sentiment-Analyse-Programm weiter.
Das Sentiment Analyse Programm **muss** mehrzeilige Eingaben händeln,
wobei die Zeilen entweder jeweils eine JSON representation der geschilderten Posts sein muss,
oder eine komplett leere Zeile (welche ignoriert werden muss).
Hier wurde bereits mit einem Python-Script, welches nltk über die TextBlob-Library nutzt,
als auch über ml-sentiment, ein Machine-Learning basiertes Sentiment Analyse-Framework ein Implementiertes Programm bereit gestellt.

Die Ergebnisse der Sentiment-Analyse werden jedem Post hinzugefügt.

Damit hat ein Post folgende Struktur:
```
# one post as "message" event data
{
 "username": <String>       // what ever the user name is, may also be Anonymous or similar
 "platform": <String>       // "twitter", "4chan", etc.
 "text": <String>           // a formatted text without platform specific symbols like RT for Retweet
 "originalText": <String>   // the original text containing everything
 "emotion": <String>        // "positive", "negative", "neutral" or "pos", "neg" (deprecated)
 "score": <Float>           // a sentiment score between -1 (negative) and 1 (positive)
 "keywords": <String>[]     // list of names and proper nouns, which seem to be significant for the text
 "timestamp": <String>      // a string of an ISO 8601 timestamp
} 
```

Um diese Events zu erhalten, wird ein Server-Sent-Events Stream unter GET /events zur Verfügung gestellt.