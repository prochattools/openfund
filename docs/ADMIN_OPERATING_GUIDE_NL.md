# Yeshua Academy Finance — Beheerdersgids (NL)

Status: gezaghebbend  
Taal: Nederlands  
Geldig voor: beheerders (rol `admin`)  
Afhankelijk van: `docs/PHILOSOPHY.md`, `docs/STRATEGY.md`

---

## 1. Inloggen en rollen

De applicatie kent twee rollen:

| Rol | Omschrijving |
|-----|-------------|
| `admin` | Beheerder — volledige toegang inclusief import, beoordeling, afsluiting, rapportage en verspreiding |
| `viewer` | Lezer — alleen leestoegang op grootboek, rapporten en auditlog |

Rolcontrole wordt server-side afgedwongen. Alleen de HTTP-header `x-user-role: admin` geeft toegang tot mutatieroutes. Afwijzingen worden teruggegeven als HTTP 403 met de melding:

> `Alleen beheerders mogen deze actie uitvoeren.`

Zorg dat de webserver of authenticatiemiddleware de juiste headers instelt voordat API-verzoeken worden doorgegeven.

---

## 2. Maandelijkse ING CSV-upload en importvoorbeeld

### Stap 1 — Importvoorbeeld bekijken

1. Ga naar **Importeren** in het navigatiemenu.
2. Selecteer de ING CSV-export voor de betreffende maand.
3. Het systeem toont een **importvoorbeeld** met:
   - rekening-IBAN en periode
   - aantal rijen
   - openingsbalans, inkomsten, uitgaven en slotbalans
   - aantal dubbele transacties
   - controle van de doorlopende balans (0 fouten = goed)
   - of de periode afsluitbaar is

4. Controleer de getallen. Als de totalen niet kloppen met de bankafschrift, upload dan niet.

### Stap 2 — Import bevestigen

Alleen na het bekijken van het importvoorbeeld kan de import worden uitgevoerd. Het systeem boekt geen transacties tijdens de voorbeeldweergave.

### Regels voor de import

- Elk geüpload bestand wordt onveranderd opgeslagen als bewijs (hash, bestandsnaam, grootte).
- Dubbele importvingerafdrukken worden automatisch gedetecteerd en niet opnieuw geboekt.
- Bestanden worden intern bewaard en kunnen later worden gedownload.
- **Kopieer nooit eigenaar-CSV, -XLSX of -PDF-bestanden naar de Git-repository.**

---

## 3. Deterministische categorisatie

Na de import categoriseert het systeem automatisch de transacties die voldoen aan een goedgekeurde deterministische regel of een volledig exacte historische herhaling.

Een transactie wordt automatisch geboekt als:

1. precies één actieve, goedgekeurde categorisatieregel overeenkomt (met richting, tegenpartij/IBAN, betalingskenmerk of bedrag), **of**
2. een volledige historische herhaling met precies dezelfde `Klant`, `Type` en `Categorie` overeenkomt.

Transacties die niet aan deze criteria voldoen, gaan naar de **beoordelingsrij**.

---

## 4. Beoordelingsrij

Ga naar **Beoordelen** om onzekere transacties te bekijken.

Per transactie toont het systeem:

- datum, tegenpartij, IBAN, bedrag en richting
- volledig betalingskenmerk (originele ING-tekst)
- voorgestelde `Klant`, `Type` en `Categorie` met bewijs
- deterministische status: `gefinaliseerd`, `suggestie`, `conflict` of `geen match`
- alternatieve kandidaten wanneer er meerdere opties zijn

### Wat de beheerder doet

- **Goedkeuren**: selecteer `Klant`, `Type` en `Categorie` en klik op Goedkeuren. Alle drie dimensies zijn verplicht.
- **Handmatig categoriseren**: kies een andere combinatie wanneer de suggestie onjuist is.
- **Regels aanmaken**: zie § 6.

Het systeem kent **geen bulkbevestiging**. Elke transactie vereist een expliciete beslissing.

---

## 5. Handmatige keuze van Klant, Type en Categorie

Bij het goedkeuren of handmatig categoriseren zijn altijd drie velden verplicht:

| Veld | Betekenis |
|------|-----------|
| `Klant` | Organisatie of project: `FTK`, `FR`, `WLJ`, `YA`, `VS`, `Algemeen` |
| `Type` | Brede verslaggevingsklasse: bijv. `Schenking`, `Ondersteuning`, `Spaarrekening` |
| `Categorie` | Gedetailleerde boekingscategorie: behoud de exacte historische naam |

**Gebruik de historische namen exact zoals ze zijn geboekt.** Corrigeer nooit spelling, hoofdletters of woordkeuze van historische labels.

---

## 6. Regel aanmaken na goedgekeurde beslissing

Na het goedkeuren van een transactie kan de beheerder optioneel een herbruikbare categorisatieregel aanmaken.

### Stap 1 — Regelvoorbeeld bekijken

1. Open de goedgekeurde transactie in de beoordelingsrij.
2. Klik op **Regelvoorbeeld**. Het systeem toont:
   - de verwachte `Klant`, `Type` en `Categorie`
   - de regelcondities (bijv. betalingskenmerk bevat "tienden")
   - het aantal overeenkomende voorbeeldtransacties
   - of activering is toegestaan of geblokkeerd

### Stap 2 — Regel activeren

3. Als het voorbeeld correct is, vul de previewhash in en klik op **Activeren** met `explicitConfirmation: true`.

### Beperkingen

- Brede, dubbelzinnige, conflicterende of onvolledige regelkandidaten worden geweigerd.
- Een nieuwe regel mag niet conflicteren met een bestaande actieve regel.
- Regelactivering maakt geen transactieboekingen aan en sluit geen perioden.

---

## 7. Afschriftreconciliatie — voorbeeldweergave

Ga naar de reconciliatiepagina voor een gesloten of volledig beoordeelde periode.

Het systeem berekent:

- openingsbalans + inkomsten − uitgaven = slotbalans (differentiaal moet EUR 0,00 zijn)
- som categorie-inkomsten = totale inkomsten (differentiaal moet EUR 0,00 zijn)
- som categorie-uitgaven = totale uitgaven (differentiaal moet EUR 0,00 zijn)
- aantal onopgeloste beoordelingsitems (moet 0 zijn)

Een periode is alleen afsluitbaar als **alle** differentialen EUR 0,00 zijn en er **geen** onopgeloste transacties zijn.

---

## 8. Categoriecontroles

Het systeem gebruikt drie dimensies voor categorisatie:

1. **Klant** (`Project`): `FTK`, `FR`, `WLJ`, `YA`, `VS`, `Algemeen`
2. **Type** (`TransactionType`): brede verslaggevingsklassen
3. **Categorie** (`Category`): gedetailleerde boekingscategorieën

Intern overboeking, spaar, stortingen, restituties en terugboekingen zijn aparte categorieën en worden **uitgesloten** van de gewone operationele inkomsten/uitgaven in rapporten.

---

## 9. Periode afsluiten

Een periode kan alleen worden afgesloten als:

1. de afschriftreconciliatie BALANCED is (differentiaal EUR 0,00)
2. de categoriecontroles BALANCED zijn (alle categoriedifferentialen EUR 0,00)
3. alle transacties een volledige boeking hebben (Klant + Type + Categorie)
4. er geen onopgeloste beoordelingsitems zijn
5. het transactieaantal overeenkomt met het afschrift
6. de beheerder `confirmed: true` meestuurt
7. optioneel: de verwachte sluit-controlehash overeenkomt (aanbevolen)

**Gedeeltelijke perioden (bijv. juli 2026) kunnen nooit worden afgesloten.** Upload eerst een volledig afschrift.

---

## 10. Periode heropenen (audited reopen)

Gebruik heropenen alleen wanneer een onjuistheid in een gesloten periode moet worden gecorrigeerd.

Vereisten:

- beheerderrol
- niet-lege reden
- werkruimte-ID

Het systeem:
- zet de periodestatus van CLOSED naar REOPENED
- herroept actieve rapportgoedkeuringen voor die periode
- schrijft een auditlogboekregel (`period.close.reopened`)
- verwijdert geen boekingen of snapshots

---

## 11. Maand- en jaarrapporten

Rapporten worden gegenereerd op basis van **gesloten** periodesnaps.

### Maandrapport

1. Controleer via `GET /api/reports/monthly/:year/:month/preview` of de periode gesloten is.
2. Genereer het snapshot via `POST /api/reports/monthly/:year/:month/snapshot`.
3. Het rapport bevat: openingsbalans, inkomsten, uitgaven, nettobewegingen, slotbalans, en totalen per Klant, Type en Categorie.

### Jaarrapport

- Genereert een gecombineerd snapshot van alle gesloten maanden van het jaar.
- Openingsbalans komt van de eerste gesloten maand.
- Inkomsten en uitgaven worden opgeteld over alle gesloten maanden.

### Presentatieclassificatie

Rapportregels worden geclassificeerd als:

| Klasse | Omschrijving |
|--------|-------------|
| `OPERATING` | Gewone bedrijfsinkomsten en -uitgaven |
| `TRANSFER` | Interne overboekingen en spaarbewegingen |
| `DEPOSIT` | Stortingen en terugbetaalde stortingen |
| `REFUND` | Restituties en terugboekingen |
| `RESTRICTED` | Doelinkomsten en -betalingen |

Alle euro's zijn zichtbaar; alleen OPERATING telt mee in de operationele subtotalen.

---

## 12. Rapportartefacten

Genereer HTML, XLSX en PDF-plaatshouder via `POST /api/reports/:snapshotId/artifacts`.

- HTML en XLSX worden gegenereerd uit het immutable snapshot.
- **PDF is een plaatshouder.** Echte PDF-generatie vereist een door de eigenaar goedgekeurde afhankelijkheid.
  De constante `PDF_BLOCKER` in `server/services/reportArtifactService.ts` documenteert de vereiste.
- Alle artefacten zijn SHA-256 gehasht en gekoppeld aan het snapshot-ID.

---

## 13. Rapportgoedkeuring en verzendmetadata

### Goedkeuring

1. Roep `POST /api/reports/:snapshotId/approve` aan met de verwachte snapshot-hash.
2. Het systeem controleert of de periode niet heropend is.
3. De goedkeuring is onveranderlijk en gekoppeld aan de beheerder en het tijdstip.

### Verzendvoorbereiding

1. Roep `POST /api/reports/:snapshotId/dispatch/prepare` aan met:
   - `reportApprovalId` (verwijst naar de goedkeuring)
   - `fromAddress` (afzenderadres)
   - `subject` (onderwerp in het Nederlands)
   - `recipients` (lijst van ontvangers)
   - `contentHash` (SHA-256 van de inhoud)

2. Het systeem **verzend geen e-mail**. `sendsEmail: false` en `callsExternalProvider: false` zijn altijd ingesteld.
3. Verzendmetadata (ontvangers, inhoud-hash, tijdstip) wordt bewaard voor auditdoeleinden.

**Echte e-mailverzending vereist een door de eigenaar geconfigureerde e-mailprovider. Stel dit niet in zonder expliciete goedkeuring.**

---

## 14. Bronbestand-downloads

Originele geüploade bestanden zijn onveranderd bewaard en kunnen worden gedownload via:

```
GET /api/import-batches/:id/download
```

Het systeem stuurt het originele bestand terug met de originele bestandsnaam en SHA-256-hash in de `X-File-Sha256`-header.

**Nooit**: kopieer het originele bestand opnieuw naar de repository. Het bestand staat intern opgeslagen.

---

## 15. Wat niet te doen

| Handeling | Reden |
|-----------|-------|
| Productie-import zonder goedkeuring van de eigenaar | Historische import is operator-gecontroleerd en geblokkeerd in de productie-codepath |
| Eigenaar-bestanden (XLSX, CSV, PDF) in Git opslaan | Privacybescherming en veiligheidsvereiste; bestanden zijn al intern bewaard |
| E-mail verzenden zonder geconfigureerde provider | Het systeem heeft geen verzendprovider geconfigureerd; verzending is intentioneel geblokkeerd |
| Echte PDF genereren vóór goedkeuring van afhankelijkheid | `PDF_BLOCKER` is actief; voeg geen PDF-bibliotheek toe zonder eigenaargoedkeuring |
| Productieconfiguratie wijzigen | Geen wijzigingen in productieconfiguratie zonder afzonderlijk goedgekeurd plan |
| Prisma-migraties aanmaken zonder noodzaak | Migraties vereisen validatie op een disposable lokale database |
| Secrets of inloggegevens committen | Gebruik `.env` voor lokale inloggegevens; nooit committen |

---

## 16. Probleemoplossing

### Ongepaarde transacties

**Symptoom**: transacties blijven in de beoordelingsrij zonder passende suggestie.

**Actie**:
1. Open de transactie in de beoordelingsrij.
2. Controleer het volledige betalingskenmerk.
3. Maak handmatig een boeking aan (Klant + Type + Categorie).
4. Overweeg een deterministische regel aan te maken als dit patroon vaker voorkomt.

### Ongebalanceerde afschriftreconciliatie

**Symptoom**: de slotbalans-differentiaal is niet EUR 0,00.

**Oorzaken**:
- Ontbrekende transacties (controleer het rij-aantal ten opzichte van het bankafschrift)
- Dubbele boekingen (import-dubbele worden gedetecteerd)
- Onjuiste beginbalans (pas aan via Instellingen → Rekeningen)

**Actie**:
1. Controleer de afschriftcontroles via `GET /api/reconciliation/statement-periods/:id/preview`.
2. Herstel de ontbrekende of onjuiste gegevens.
3. Sluit de periode pas af als alle differentialen EUR 0,00 zijn.

### Ontbrekende boeking

**Symptoom**: een transactie heeft wel een categorie maar geen volledige boeking (Klant + Type + Categorie).

**Actie**:
1. Zoek de transactie op in de beoordelingsrij.
2. Voeg de ontbrekende dimensies toe via de handmatige categorisatie.

### Ingetrokken goedkeuring na heropening

**Symptoom**: een eerder goedgekeurde rapportgoedkeuring is ingetrokken na het heropenen van de periode.

**Verklaring**: het systeem trekt automatisch actieve goedkeuringen in bij heropening om te voorkomen dat een heropend rapport wordt verzonden.

**Actie**:
1. Corrigeer de transacties in de heropende periode.
2. Sluit de periode opnieuw af.
3. Genereer een nieuw snapshot.
4. Keur het nieuwe snapshot opnieuw goed.

### PDF-plaatshouderblokkering

**Symptoom**: `POST /api/reports/:snapshotId/artifacts` geeft een `pdfBlocker`-veld terug in het antwoord.

**Verklaring**: echte PDF-generatie is intentioneel geblokkeerd totdat een PDF-bibliotheek is goedgekeurd door de eigenaar. De constante `PDF_BLOCKER` in `server/services/reportArtifactService.ts` documenteert de vereiste.

**Actie**:
1. Gebruik de HTML- en XLSX-artefacten in de tussentijd.
2. Vraag de eigenaar om een PDF-bibliotheek goed te keuren voordat PDF-generatie wordt geïmplementeerd.
3. Voeg **geen** PDF-bibliotheek toe zonder expliciete goedkeuring.

---

## Noot voor de ontwikkelaar

Dit document is uitsluitend in het Nederlands opgesteld voor administratieve gebruikers. Code-identifiers, testnamen en technische logs mogen in het Engels zijn. Externe ING-bronkolomnamen (bijv. `Date`, `Notifications`, `Counterparty`) blijven ongewijzigd omdat ze onderdeel zijn van het originele bankbewijs.
