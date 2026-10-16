# Verifica delle generazioni rosse — 16 ottobre 2026

Esaminate tutte le 26 righe in stato Needs attention su 2.455 righe admin, usando lo stesso caricamento e la stessa classificazione della tabella. La verifica riguarda questo checkout e i suoi dati locali condivisi. Le righe possono essere rosse anche con una generazione riuscita se manca un requisito, per esempio la Main Image.

## Correzioni nel codice

- Nuovo retry limitato delle richieste Ollama per HTTP 502/503/504: al massimo tre richieste, pause di 500 ms e 1 s, cancellazione rispettata. Nessun retry aggiunto per HTTP 429/402 o errori di validazione. Copre Story e Person.
- Associazione Wikidata consapevole dei redirect: due ID diversi sono accettati soltanto se l’API conferma lo stesso ID canonico. L’associazione salva l’ID canonico; identità diverse o non verificabili restano bloccate.
- Le tre ambiguità persona/opera/luogo sono coperte dalla correzione dei candidati non umani già presente nel checkout.

Le modifiche non eseguono nuove generazioni, non aggiornano le immagini o le Story salvate e non cancellano log/checkpoint. Gli esiti delle vecchie esecuzioni rimangono finché non viene completata una nuova azione.

## Esame una riga alla volta

| # | Riga | Diagnosi | Azione |
|---|---|---|---|
| 1 | Archivio museo storico di Fiume | Immagine mancante | Nessun P18/P373 su Wikidata e nessuna page image nella fonte italiana. Cercare una foto specifica con licenza e attribuzione. |
| 2 | Basilica di San Pietro in Vincoli | Giulio II: persona e tomba con la stessa etichetta | Il filtro dei candidati non umani già aggiunto copre il caso. Eseguire Retry unresolved People. |
| 3 | Basilica Hilariana | Identità sorgente errata; immagine mancante | Il POI usa Q3959538, una pagina elenco di basiliche, non la Basilica Hilariana. Correggere prima il riferimento specifico; poi riesaminare Story e immagine. |
| 4 | Biblioteca di Archeologia e Storia dell'Arte | Felice Barnabei: HTTP 502 di Ollama | Aggiunti fino a due retry di trasporto per 502/503/504. Eseguire Retry unresolved People. |
| 5 | Castello di Corcolle | Immagine mancante | Nessun P18/P373 su Wikidata e nessuna page image nella fonte italiana. Ricerca editoriale di una foto specifica. |
| 6 | Castello di Giulio II | Conflitto reale tra record Wikidata | Q3939487 e Q54863376 sono ancora entità distinte: rocca ed entità museale. Manteniamo il blocco; occorre scegliere il perimetro del POI e una fonte coerente. |
| 7 | Catacombe di San Zotico | Immagine mancante | Nessun P18/P373 e nessuna page image nella fonte inglese. Ricerca editoriale di una foto specifica. |
| 8 | Catacombe di Santa Felicita | Immagine mancante | Nessun P18/P373 e nessuna page image nella fonte inglese. Ricerca editoriale di una foto specifica. |
| 9 | Chiesa Nuova | Pietro da Cortona: persona e città con la stessa etichetta | La fonte contiene Pietro da Cortona e Cortona con la stessa etichetta. Il filtro dei candidati non umani già aggiunto copre il caso. Retry unresolved People. |
| 10 | Colombari di via Taranto | Immagine mancante | La fonte e Wikidata identificano i Colombari di Via Pescara; nessun P18/P373 o page image disponibile. Ricerca editoriale di una foto specifica. |
| 11 | Colombario Costantiniano | Log riuscito associato a un altro elemento geografico | Il log punta a colombario-costantiniano, ma quel POI è legato a node/4406771103 e coordinate diverse. La riga way/158043302 non ha POI/Story. Verificare sul territorio se siano duplicati o luoghi distinti; non unire solo per nome. |
| 12 | Criptoportico Neroniano | Identità generica e immagine di un altro luogo | Q660398 è il concetto cryptoporticus, non il luogo sul Palatino. L’immagine selezionata è Castel-Gandolfo-Cryptoporticus.JPG; anche la Story descrive il concetto generico. Correggere identità e fonti prima di rigenerare Story/immagini. Non aggiungere un tipo per far diventare verde la riga. |
| 13 | Domus and Mitreo delle Pareti Dipinte (III,I,6) | Falso conflitto: redirect Wikidata | Q127883866 reindirizza a Q124218142. Aggiunto riconoscimento dei redirect nell’associazione dell’identità. Refresh types può riacquisire i tipi dell’alias; un nuovo passaggio di generazione applicherà la canonicalizzazione. |
| 14 | Domus delle Gorgoni (I,XIII,6) | Immagine mancante | Nessun P18/P373 su Wikidata e nessuna page image italiana. Ricerca editoriale di una foto specifica. |
| 15 | Ficana | Immagine mancante | Nessun P18/P373 e nessuna page image nella fonte inglese. Ricerca editoriale di una foto specifica. |
| 16 | Fontana di piazza dell'Aracoeli | Story assente: JSON del modello non valido | Esaminate entrambe le risposte diagnostiche. Negli array compaiono elementi con struttura rotta, non solo una virgola mancante; jsonrepair non basta. Riprovare la Story con il prompt attuale, eventualmente con un altro modello; niente recupero che inventi campi. |
| 17 | Forte Boccea | Immagine mancante | Nessun P18/P373 e nessuna page image nella fonte inglese. Ricerca editoriale di una foto specifica. |
| 18 | Forte Braschi | Immagine mancante; categoria Commons vuota | Wikidata indica Category:Forte Braschi, ma la richiesta categorymembers per i file restituisce un elenco vuoto. Il fallback alla categoria è stato provato e rimosso perché non risolve il caso. |
| 19 | Forte Monte Mario | Immagine mancante | Nessun P18/P373 su Wikidata. Il controllo live della page image ha ricevuto HTTP 429, quindi resta non verificato; non assumere che la foto non esista. Ricontrollare in seguito o cercare una foto specifica. |
| 20 | Galleria Borghese | Paolo V: persona e busto con la stessa etichetta | La fonte contiene Pope Paul V e Bust of Pope Paul V. Il filtro dei candidati non umani già aggiunto copre il caso. Retry unresolved People. |
| 21 | Mausoleo di Campo Barbarico | Falso conflitto: redirect Wikidata | Q97180948 reindirizza a Q65174339. Aggiunto riconoscimento dei redirect. Refresh types può riacquisire i tipi dell’alias; un nuovo passaggio di generazione applicherà la canonicalizzazione. |
| 22 | Mausoleo di Costanza | Tipi non acquisiti: HTTP 429 | L’identità Q831361 è coerente e contiene tipi. Riprovare Refresh types; il codice attuale usa già il retry Wikimedia con Retry-After. |
| 23 | Mausoleo Ossario Garibaldino | Tipi non acquisiti: HTTP 429 | L’identità Q55360083 è coerente e contiene tipi. Riprovare Refresh types; nessuna correzione manuale dell’identità necessaria. |
| 24 | Miliarum Aureum | Tipi non acquisiti: HTTP 429 | L’identità Q916963 è coerente e contiene tipi. Riprovare Refresh types; nessuna correzione manuale dell’identità necessaria. |
| 25 | Mitreo del felicissimo (V,IX,1) | Story assente: HTTP 502 di Ollama | Aggiunti fino a due retry di trasporto per 502/503/504. Riprovare la generazione della Story. |
| 26 | Mitreo delle Sette Sfere (II,VIII,6) | Conflitto reale tra record Wikidata | Q130507607 e Q132187842 sono ancora entità distinte, non redirect. Il secondo ha la pagina italiana e l’immagine; la somiglianza non basta a fondere le identità. Verificare e scegliere il record corretto per il POI. |

## Evidenze

- Confrontati gli errori attualmente mostrati dall’admin, i checkpoint, i log di generazione, le fonti Wikipedia salvate, il catalogo versionato e le risposte diagnostiche del modello.
- Controllati live i record Wikidata delle righe rosse e delle identità in conflitto tramite wbgetentities; controllate le page image delle fonti senza immagini, salvo Forte Monte Mario che ha ricevuto 429.
- Redirect confermati nelle risposte API: [Q127883866](https://www.wikidata.org/wiki/Special:EntityData/Q127883866.json) → Q124218142 e [Q97180948](https://www.wikidata.org/wiki/Special:EntityData/Q97180948.json) → Q65174339.
- Categoria [Forte Braschi](https://commons.wikimedia.org/wiki/Category:Forte_Braschi): nessun file diretto restituito dalla query categorymembers al momento della verifica. Questo controllo non esclude altre foto su Commons o altrove.
- Il mancato reperimento delle immagini dai canali automatici attuali non dimostra l’assenza di foto disponibili e riutilizzabili.
