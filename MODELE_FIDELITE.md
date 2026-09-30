# Modèle de fidélité v3 — points cumulables, dépensés sur un seul produit

Statut : **proposition, non appliquée au code ni à la base.** Chiffres calculés (Decimal).

## 1. Principe
- Chaque **paiement validé** rapporte des points. Le gain augmente avec le nombre de paiements : `gain(n) = 0,5 + 0,1 × ⌊n / 3⌋` (n = numéro du paiement validé).
- Les points **s'accumulent** tant que le client ne les utilise pas (pas d'expiration par défaut).
- **1 point = 1 % de remise sur le prix d'un produit.** À la commande, le client choisit **un seul produit** du panier et le **nombre de points** à y consacrer (pas de 0,1). Ce pourcentage ne s'applique qu'à ce produit.

## 2. Gain par paiement et cumul
| Paiement n° | Gain | Cumul si rien n'est dépensé |
|---|---|---|
| 1 – 2 | 0,5 pt | 0,5 → 1,0 |
| 3 – 5 | 0,6 pt | 1,6 (au 3e) |
| 6 – 8 | 0,7 pt | 3,5 (au 6e) |
| 9 – 11 | 0,8 pt | 5,7 (au 9e) |
| 12 – 14 | 0,9 pt | 8,2 (au 12e) |
| 15 – 17 | 1,0 pt | 11,0 (au 15e) |
| 18 – 20 | 1,1 pt | 14,1 (au 18e) |
| 24 | 1,3 pt | 21,2 |
| 30 | 1,5 pt | 29,5 |
| 45 | 2,0 pt | 55,5 |
| 60 | 2,5 pt | 89,0 |
Au-delà de 1 pt de gain : 1,1 · 1,2 · 1,3 … tous les 3 paiements.

## 3. Utilisation sur un produit
- Le client choisit le produit (une seule ligne du panier) et `X` points, avec `0,1 ≤ X ≤ solde` et `X ≤ plafond`.
- Remise = ⌊ prix unitaire du produit × X / 100 ⌋, appliquée à **une unité** du produit (si quantité > 1, les autres unités restent au prix normal).
- Exemple, produit à 20 000 F : 1,6 pt → 320 F · 10 pt → 2 000 F.
- Les points dépensés sont **débités à la création de la commande** et **rendus** si elle est annulée ou rejetée. Les points gagnés par une commande ne servent qu'à partir de sa validation (pas dans la même commande).
- Non cumulable avec un coupon sur le même produit (réglage).

## 4. Points gagnés : quand et sur quelle base
- Gain crédité une seule fois quand la commande est **livrée et payée** (idempotent par commande). Annulée, rejetée ou remboursée : pas de points ; remboursement après coup : reprise des points gagnés.
- Le gain ne dépend pas du montant (0,5 pt même pour une petite commande) : prévoir un **montant minimum** pour compter (ex. 1 000 F) et **un paiement compté par boutique et par jour**.

## 5. Coût : à plafonner
Le cumul devient vite élevé (11 pt au 15e paiement, 21 pt au 24e, 89 pt au 60e) ; sans limite, un solde de 100 pt = 100 % de remise. Réglages proposés : **plafond par utilisation = 20 pt (20 % du produit)**, atteint au 24e paiement si rien n'a été dépensé ; réglable par boutique.

## 6. Stockage
- Grand livre des points en **dixièmes de point** (entiers, aucun flottant) : `EARNED_ORDER`, `SPENT_ITEM`, `RETURNED`, `REVERSAL`. Solde = somme du grand livre ; `bonus_points` n'est qu'un cache mis à jour dans la même transaction.
- Sur la commande : ligne produit choisie, points dépensés, remise en FCFA (figés).
- Anciens points (1 pt ≈ 25 F) : convertis en bons d'achat équivalents puis solde remis à zéro (à confirmer). Les bons déjà émis restent valables.
- Carte fidélité : solde en points, prochain gain, « encore N paiement(s) avant X pt de gain », valeur potentielle sur un produit.

## 7. À adapter dans le code
Échange points → bon d'achat (remplacé par la dépense sur un produit), remise de palier 3/5/8 %, calcul des points à la livraison, `get_customer_stats`, création de commande (choix produit + points), carte (`card_service`, `cardScene.js`), profil, panier et modales de commande. Environ 10 fichiers backend et 7 frontend.
