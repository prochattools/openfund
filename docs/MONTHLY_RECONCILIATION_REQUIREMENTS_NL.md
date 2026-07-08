# Maandelijkse Reconciliatievereisten

**Status:** IMPLEMENTATION REQUIRED

## Context

- Repo: `/Users/Office/Repos/yeshuaacademy/web/finance`
- Dokploy app: `apps-saas-open-fund-vdymfu`
- Scope: maand-op-maand accounting-graad reconciliatie en administrator reporting

## Vereisten

- Elke maand moet exact tot op de cent balanceren.
- Elk geïmporteerd CSV- of bronbestand moet bewijs behouden.
- Elke transactie mag precies één keer worden geïmporteerd.
- Alleen deterministische categorisatie met 100% zekerheid mag automatisch boeken.
- Ambigue, onbevestigde, of conflicterende matches gaan naar handmatige review.
- Een maand mag niet worden gesloten zolang unresolved transacties bestaan.
- Geen maandrapport zonder gesloten en gebalanceerde maand.
- Maandexports moeten opening, inkomsten, uitgaven, netto, closing, transactietelling, categorie-totalen, subcategorie-totalen, unresolved count, en reconciliatiebewijs tonen.
- Administrator approval is vereist voor verzending.

## Formules

- `opening + income - expenses = closing`
- `income = sum(credit transactions)`
- `expenses = absolute sum(debit transactions)`
- `net = income - expenses`
- categorie-inkomsten moeten overeenkomen met income
- categorie-uitgaven moeten overeenkomen met expenses
- `bookedTransactionCount + unresolvedTransactionCount = transactionCount`
- duplicate fingerprints moeten nul zijn
- running-balance fouten moeten nul zijn
- maand N closing moet maand N+1 opening raken voor continue ketens

## Geldregels

- Alleen integer minor units.
- Geen floating point geldbewerking.
- Geen afgeronde tussenstappen.

## Gates

- Manual review gate voor onzeker of niet-deterministisch categoriseren
- Close gate voor maandafsluiting
- Export gate voor gesloten/balanced maanden
- Report gate voor administrator approval
- Email gate voor expliciet goedgekeurde verzending

## Blokkers

- Alleen balanced, closed maanden mogen als definitieve maandrapporten worden behandeld.
- Open of ongebalanceerde maanden blijven draft.
- Real email verzending blijft apart gecontroleerd.
- PDF en e-mail blijven buiten scope zolang de operator geen verdere activering bevestigt.
