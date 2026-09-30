# Audit GotoShop — base de données et enregistrements

Date : 29/09/2026 · Périmètre : projet complet (`GotoShop.zip` + 14 correctifs de `GotoShop_correctifs.zip` intégrés), base `backend/conversastore.db` (SQLite, 44 tables) et code d'écriture (services, routers, modèles, migrations).
Méthode : 26 contrôles SQL en lecture seule (`backend/audit_db.py`), lecture du code, exécution des tests sur des **copies** de la base. `conversastore.db` livrée n'est pas modifiée.

## 1. Synthèse

| Gravité | Nb | Sujet |
|---|---|---|
| Critique | 6 | prise de compte par téléphone, prix/frais choisis par le client, stock, tests qui polluent la base, points de fidélité sans traçabilité, portefeuille jamais alimenté |
| Élevée | 5 | commandes orphelines, statuts désynchronisés, transitions libres, clients de plusieurs boutiques, coupons non tracés |
| Moyenne / info | 8 | FK non appliquées, jetons en clair, repli silencieux SQLite, unicités absentes, etc. |

Base réelle : 300 intentions, 97 commandes, 40 clients, 25 boutiques. **117 anomalies** détectées avant réparation, **40 restantes** après `repair_db.py --apply` : 39 « INFO » (numéros de carte générés à la demande) et 1 doublon de téléphone (D7, fusion manuelle). Les contrôles sur `points_remaining` ne s'exécutent qu'après le premier démarrage du serveur (la migration ajoute la colonne).

## 2. Anomalies constatées dans les enregistrements

| # | Constat (base réelle) | Cause identifiée | État |
|---|---|---|---|
| D1 | **33 commandes** pointent vers 2 clients inexistants (`0a98387b…` : 32, `b9c0e87a…` : 1) | Les tests (`tests/test_customer_order_auth.py`) **supprimaient** le client « Fanta Ouedraogo » (+22670112233) directement dans `conversastore.db` alors qu'il avait des commandes. Les FK ne sont pas appliquées par SQLite. | Cause corrigée (tests isolés) ; données réparables par `repair_db.py` (17 rattachées au client de la même boutique, 16 mises à NULL) |
| D2 | **13 clients** avec `bonus_points` (12 × 50, 1 × 700 = 1 300 pts) mais **grand livre vide** | Soldes injectés par la seed, sans écriture `loyalty_points_ledger` | `repair_db.py` : écriture d'ouverture `MANUAL_ADJUSTMENT` (solde conservé, traçable) |
| D3 | **16 commandes livrées** avec client mais **sans points `EARNED_ORDER`** | Client introuvable (D1) → `credit_points` lève une erreur avalée par un `print` | Non crédité automatiquement (décision métier) ; cause D1 traitée |
| D4 | **15 commandes CANCELLED** dont l'intention liée reste `CREATED/PENDING` | Seule `cancel_order` synchronisait l'intention ; refus (`reject_order`) et changement de statut non | Code corrigé ; données par `repair_db.py` |
| D5 | **Toutes** les intentions liées à une commande (96) restent `CREATED`, même commande `COMPLETED` | L'intention « pont » n'évolue jamais après création | À décider : le suivi passe par `orders`, l'intention sert d'archive analytique |
| D6 | Wallet : **12 transactions** sur des commandes inexistantes (`test-ord-escrow-…`) ; **23 commandes COMPLETED sans transaction wallet** | Tests écrits sur la base réelle ; l'escrow n'est crédité qu'à la confirmation de paiement (`payment_service`), jamais pour les commandes seedées | Signalé ; nettoyage manuel des lignes de test conseillé |
| D7 | Doublon de téléphone dans la boutique `e5164009…` : `+22507123456` et `+225 07 12 34 56` | Numéro non normalisé (seed / `create_order` qui stocke le téléphone brut) | Signalé (fusion = décision métier) ; contrôle `audit_db.py` ajouté |
| D8 | `orders KSD-1045` sans intention liée | Création interrompue / seed | Signalé |
| D9 | 7 boutiques : `sales_count` / `revenue` ≠ commandes réelles ; 32 produits : `sales_count` ≠ ventes réelles | Compteurs dénormalisés gonflés par la seed ; mis à jour seulement par `commerce_service` | Signalé (chiffres de démonstration) |
| D10 | 9 boutiques sans `loyalty_tiers` | Paliers par défaut (`DEFAULT_TIERS`) utilisés en repli | Info |
| D11 | 39 clients sans `loyalty_card_no` | Généré à la demande par `card_service.ensure_card_number` | Info (normal) |

Sains : aucun doublon de `order_number`/`reference_code`, totaux commandes = lignes + frais − remise, un paiement par commande, montants paiement = total commande, aucune ligne/variante/produit/conversation/message orphelin, aucun stock négatif, chaîne `balance_before/after` du wallet cohérente.

## 3. Failles dans le code d'écriture

| # | Gravité | Problème | Correctif appliqué |
|---|---|---|---|
| C1 | Critique | `create_order` retrouvait un client **par téléphone seul**, lui **imposait le jeton de session fourni par l'appelant** et renvoyait son `session_token` : quiconque connaît un numéro pouvait prendre le compte (commandes, points, bons) | Recherche bornée à la boutique ; rattachement seulement avec un jeton valide ; sinon commande « invité » avec jeton propre |
| C2 | Critique | Le **prix unitaire envoyé par le client** primait sur le catalogue (prix négatif accepté) ; `delivery_fee` libre (négatif accepté) ; produit d'une autre boutique acceptable | Prix issu du catalogue (article hors catalogue : prix ≥ 0) ; frais ≥ 0 ; produit restreint à la boutique |
| C3 | Critique | Stock : écrêté à 0 sans contrôle (survente) ; `cancel_order` re-créditait le stock à **chaque** appel ; refus et changement de statut vers CANCELLED/REJECTED ne remettaient pas le stock | Refus si stock insuffisant ; `_release_order_resources` (stock + coupon + intention) appelée une seule fois, aussi par `reject_order` et `update_order_status` ; annulation idempotente |
| C4 | Critique | Tests exécutés sur la base réelle (création/suppression de clients, wallet) | `tests/conftest.py` : copie jetable de la base pour toute la suite |
| C5 | Élevée | `update_order_status` : transitions libres (CANCELLED → DELIVERED…) ; points calculés à `total/1000` en ignorant `loyalty_spend_per_point` et `is_loyalty_active` | États finaux verrouillés ; taux et activation de la boutique respectés |
| C6 | Élevée | Coupon marqué utilisé sans `order_id`, jamais libéré à l'annulation | `order_id` renseigné ; libéré si la commande est annulée/refusée |
| C7 | Élevée | `quick_register`/`quick_login` : client cherché par téléphone **toutes boutiques confondues** ; liaison des intentions invitées sans filtre de boutique ; `update_profile` sans contrôle d'unicité | Bornés à la boutique (si `store_id` fourni pour le login) ; unicité téléphone/boutique |
| C8 | Moyenne | Migration `_backfill_points_remaining` comptait les entrées `EXPIRED` comme consommations → points restants sous-évalués | Entrées `EXPIRED` exclues |
| C9 | Moyenne | Unicités absentes des bases existantes (carte fidélité, `order_id+entry_type` du grand livre, code coupon) : anti-doublon seulement applicatif | Index uniques idempotents créés par `run_migrations` (ignorés avec message si des doublons existent) |
| C10 | Moyenne | (rectificatif) `order_number` **est** unique en base : une course produit une erreur `IntegrityError`, pas un doublon | Aucun changement |

## 4. Traité en second passage

| Point | Action |
|---|---|
| Clés étrangères SQLite | `GOTOSHOP_SQLITE_FK=1` les active (opt-in, **après** `repair_db.py`). Avec l'option, `test_customer_order_auth` échoue car il supprime un client ayant des commandes : c'est la protection qui fonctionne, le test est à réécrire. |
| Repli PostgreSQL → SQLite | Désactivé : erreur 503 au lieu d'écrire dans un fichier local. `ALLOW_SQLITE_FALLBACK=1` le réactive (toujours actif sur Vercel). |
| Réglages de production | `PAYMENT_SIMULATOR` désactivé par défaut hors SQLite ; avertissement au démarrage si `OTP_SECRET` / `CARD_SIGNING_KEY` manquent. **À vous de les définir.** |
| Concurrence | Verrou de ligne sur le produit et le coupon dans `create_order` (ignoré par SQLite) ; un coupon déjà utilisé n'est plus consommé deux fois. |
| Téléphone | Un nouveau client est enregistré avec un numéro normalisé (fin des doublons `+225 07…` / `+22507…`). |
| Dépôt | `.gitignore` : `backend/*.db`, `*.bak`, `TEST_CREDENTIALS_LOCAL.md`, `.python-version`. Si déjà versionnés : `git rm --cached`. |

## 4 bis. Troisième passage — traité

| Point | Action |
|---|---|
| Frais de livraison | `delivery_cities.delivery_fee` ; tarif de la ville imposé par le serveur, sinon valeur client bornée (`MAX_UNCONFIGURED_DELIVERY_FEE`, 5000). |
| Connexion par téléphone seul | OTP disponible (`/customer/login/otp/request` + `otp_code`), activé par `REQUIRE_LOGIN_OTP=1`. **Désactivé par défaut** : tant qu'il l'est, le risque C1-bis (prise de compte par numéro sur `quick-login`) demeure. |
| Jetons de session | Commerçants et super-admins : hachés (SHA-256, préfixe `h1$`), migration automatique. |
| Accès démo (nouveau constat) | Mots de passe maîtres codés en dur, alias, `demo_login` et jetons `demo_owner_token_*` contournaient l'authentification : coupés sauf `ALLOW_DEMO_ACCESS=1`. |
| D3, D6, D7 | `cleanup_db.py` (simulation par défaut). D3 : après `repair_db.py`, les commandes livrées n'ont plus de client (16 mises à NULL) -> points non récupérables. D6 : la purge complète exige `--purge-pending-withdrawals` (6 retraits PENDING à confirmer comme tests). |
| Tests | `test_conversational_commerce.py` migré dans `tests/`. 24 réussis ; `test_e2e.py` reste à migrer. |

## 4 ter. Quatrième passage — traité

| Point | Action |
|---|---|
| OTP branché | Codes stockés **en base** (table `otp_codes`, HMAC, usage unique, 3 essais, 5 min) : plus de dépendance à la mémoire du processus (Vercel / multi-instances). Envoi par `services/sms_service.py` : `SMS_PROVIDER=webhook` (`SMS_WEBHOOK_URL`, `SMS_WEBHOOK_TOKEN`) ou `twilio` (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`). Sans fournisseur et hors simulateur : erreur claire, aucun code n'est renvoyé dans la réponse. La clé OTP de connexion ne dépend plus de la boutique (la demande et la vérification pouvaient viser deux boutiques). |
| OTP côté frontend | `CustomerAuthModal` : si le serveur exige un code, le SMS est demandé automatiquement et un champ de saisie apparaît (inscription et connexion). Les erreurs OTP ne déclenchent plus le repli « profil local ». |
| Tarifs de livraison | Routes `GET/POST/PUT/DELETE /store/{id}/delivery-cities` (écriture réservée au propriétaire de la boutique ou au super-admin, tarif entier ≥ 0, doublons refusés, ville par défaut maintenue) + section « Zones & Tarifs de Livraison » dans Réglages (`DeliveryCitiesSection.jsx`). |
| Tests | `test_e2e.py` déplacé dans `tests/test_e2e_legacy.py` et **ignoré avec motif** (scénario obsolète : boutique unique à la racine, routes admin sans jeton) ; remplacé par `test_smoke_api.py`. Nouveau `test_delivery_cities_admin.py` (routes, isolation, OTP en base, expiration, webhook SMS). **35 réussis, 1 ignoré.** |
| Frontend | `vite build` réussi (compilation vérifiée ; pas d'exécution dans un navigateur). |

## 4 quater. Reste à faire

1. **Activer l'OTP en production** : choisir un fournisseur SMS (`SMS_PROVIDER`), désactiver `PAYMENT_SIMULATOR`, puis `REQUIRE_LOGIN_OTP=1`. Non testé avec un vrai fournisseur. `ConversationalOrderModal` et `TunnelHandoffModal` appellent `quick-register` directement : avec l'OTP actif, le premier ouvre `CustomerAuthModal` (qui gère le code) ; le comportement du second n'a pas été vérifié.
2. **Jetons clients en clair** (`customers.session_token`, `orders.customer_token`, `conversations.customer_token`) : **non fait**. Ces valeurs servent à la fois de secret et d'identifiant (propriété des commandes, notifications, chat, jeton rendu au client après commande) ; hacher seulement `customers.session_token` casserait ces rapprochements. Il faut d'abord séparer « identifiant » et « secret » (ex. `customer_id` + jeton haché) et migrer notifications / chat.
3. Réécrire les flux de `test_e2e_legacy.py` qui valent encore (création d'intention, confirmation, produit, analytics) avec authentification.
4. Non testés : `cleanup_db.py` et les migrations sur PostgreSQL (dont la nouvelle table `otp_codes`), frontend dans un navigateur, envoi SMS réel.
5. Les anciens scripts `backend/test_*.py` (hors `tests/`) écrivent encore sur la base réelle.

## 4 quinquies. Cinquième passage

| Point | Action |
|---|---|
| Anciens scripts `backend/test_*.py` (§4 quater-5) | `backend/conftest.py` : toute la suite pytest tourne sur une copie jetable. Hors pytest (`python test_x.py`), ils écrivent toujours sur la base réelle. |
| OTP dans `TunnelHandoffModal` (§4 quater-1) | Comportement identique à `ConversationalOrderModal` (repli sur `CustomerAuthModal`) ; message « Vérification par SMS requise ». Lecture du code seulement, non testé dans un navigateur. |
| Jetons clients en clair (§4 quater-2), réécriture de `test_e2e_legacy.py` (§4 quater-3), PostgreSQL / SMS réel (§4 quater-4) | **Non traités** : refonte identifiant/secret à concevoir, et aucun test exécutable dans l'environnement de cette session. |

## 5. Procédure d'application

```bash
cd backend
python audit_db.py conversastore.db              # constats (lecture seule)
python repair_db.py conversastore.db             # simulation
python repair_db.py conversastore.db --apply     # sauvegarde .bak puis réparation (idempotent)
python audit_db.py conversastore.db              # contrôle après réparation
python -m pytest -q tests                        # 35 tests (+1 ignoré), sur copie jetable
python cleanup_db.py conversastore.db --merge-phones --purge-test-wallet --credit-delivered-points   # simulation (ajouter --apply)
```
Au prochain démarrage, `run_migrations` crée les index d'unicité. Sur PostgreSQL, sauvegardez avant `--apply`.

## 6. Vérifications effectuées

- `repair_db.py` testé sur une copie : simulation → écriture → 2ᵉ passage sans effet (idempotent) ; `audit_db.py` : 117 → 40 anomalies (39 info + 1 doublon de téléphone).
- `pytest tests/` : 11 réussis (7 existants dont 1 corrigé + 4 nouveaux tests d'intégrité : prix client ignoré, frais négatifs, prise de compte par téléphone, stock insuffisant, double annulation).
- `test_fixes_ownership_loyalty.py` : 32/32.
- Non concluants **avant et après** mes modifications, car dépendants de l'état de la base : `test_e2e.py` (attend une boutique « Awa Chic & Tech » à la racine) et `test_conversational_commerce.py` (attend un total = prix × 2 + 500). Ils écrivent sur la base réelle et devraient être migrés dans `tests/` avec `conftest.py`.
- Le frontend n'a pas été lancé ; les changements de comportement à vérifier côté interface : refus « Stock insuffisant » (HTTP 400), commande invitée quand le numéro appartient déjà à un compte non connecté.


## 7. Sixième passage (sur GotoShop_corrections_audit_2)

| Point | Action |
|---|---|
| Appels (bug) | `routers/calls.py` importait `CallSession` depuis `app.models.chat` (inexistant) : répondre, rejeter ou terminer un appel plantait. Corrigé (`app.models.call`). `GET /calls/history` sans paramètre répond 401/403 à un anonyme (et non 400). |
| F5 | Lieux de retrait : latitude/longitude saisissables (bouton « ma position »), vérification GPS **non bloquante** côté serveur (`gps_check` dans la réponse, alerte affichée), latitude sans longitude refusée. |
| F3 | `app/core/clock.py` : `utcnow()` renvoie la même valeur que `datetime.utcnow()` (UTC sans fuseau) sans avertissement de dépréciation ; 45 fichiers migrés. Aucun passage aux dates avec fuseau (comparaisons avec la base inchangées). Avertissements pytest : 673 -> 22. |
| F1 | `oxlint --fix` et `--fix-suggestions` : 191 -> 122 avertissements (`catch (e)` inutilisés, échappement regex). Le reste (état dans les effets, dépendances de hooks) demande des refontes. |
| Réappliqué | Tarif de la ville affiché dans `TunnelHandoffModal` ; `quick-register`, `quick-login` et `login/otp/request` rattachent le compte à la boutique du contexte (`X-Store-Slug`). Sans cela, le compte était créé dans la première boutique de la base. |
| Tests | `test_spot_gps_and_clock.py` (5 tests). **64 réussis, 1 ignoré.** |
| Navigateur (Chromium) | Commande invité avec OTP actif : code demandé, compte dans la bonne boutique, commande créée, tarif configuré appliqué. Suivi invité : `GET /orders/{id}` = 401 sans jeton, nom et téléphone visibles avec le jeton client ; l'onglet « Commandes » les affiche. |

**Point d'attention.** Dans cette version, `REQUIRE_LOGIN_OTP` vaut `false` par défaut (corrigé, conforme au prompt) ; l'activer seulement une fois `SMS_PROVIDER` configuré. Sans `SMS_PROVIDER` configuré et avec `PAYMENT_SIMULATOR` désactivé, l'inscription et la connexion client sont impossibles.

**Non traité.** M5 (jetons en localStorage -> cookies HttpOnly : chantier authentification + CORS) ; F2 (découpage des composants géants) ; 122 avertissements oxlint restants ; `test_fixes_ownership_loyalty.py` (`KeyError: 'coupon'`) et `test_master_features.py` (`QrService` introuvable), en échec avant ces modifications ; les 22 avertissements Python restants ; l'écran F5 et les corrections oxlint n'ont pas été rejoués dans un navigateur.


## 8. Septième passage — authentification sans mot de passe (Passkeys)

**Ajouté (clients, identifiés par téléphone)** : WebAuthn via `py_webauthn`. Le serveur ne reçoit que la preuve cryptographique ; aucune biométrie, PIN ni clé privée n'est stocké (seulement la clé publique).

| Élément | Détail |
|---|---|
| Modèles | `passkey_credentials`, `recovery_codes` (hash HMAC-SHA256, jamais en clair), `auth_challenges`, `security_events` ; colonne `customers.phone_verified` (défaut `false`, jamais mise à `true` automatiquement) |
| API | `/auth/passkeys/register|login/options|verify`, `GET/PATCH/DELETE /auth/passkeys`, `/auth/recovery-codes/generate|use|revoke|status`, `/auth/passkeys/recovery`, `/auth/security/events`, `/auth/sessions/revoke(-all)` |
| Sécurité | défis à usage unique (consommation atomique) et expirés en 5 min ; origine et RP ID vérifiés ; `signCount` régressif refusé ; connexion « discoverable » (aucune fuite sur l'existence d'un compte) ; limites par IP **et** par numéro pour les codes de récupération ; garde-fou : impossible de révoquer sa dernière Passkey sans code de récupération |
| Récupération | un code (10 par jeu, usage unique, régénération = invalidation des anciens) donne un jeton limité de 10 min, valable uniquement pour enregistrer une nouvelle Passkey |
| Abstraction | `PhoneVerificationProvider` (`services/phone_verification.py`) ; s'active avec `OTP_REQUIRED_FOR_ACCOUNT_RECOVERY=true` |
| Frontend | `api/passkeys.js`, `PasskeyLoginBlock` (bouton « Utiliser ma Passkey » + « Récupérer mon compte », dans `CustomerAuthModal`), `PasskeySecurityPanel` (appareils, codes, sessions ; onglet Coordonnées du profil) |
| Tests | `tests/test_passkeys.py` : 9 tests avec un authentificateur logiciel ES256 (enrôlement, connexion, rejeu, mauvaise origine, défi expiré, signature falsifiée, compteur régressif, révocation, récupération, anti brute-force). **73 réussis, 1 ignoré.** |

**Réglage** : `PASSWORD_AUTH_ENABLED` vaut `true` par défaut parce que les **commerçants** (Owner) et le super-admin n'ont pas encore de Passkey ; le passer à `false` les bloquerait. Le drapeau est câblé sur `/auth/login` et `/auth/change-password`.

**Tests hérités** : `test_master_features.py` importait `QrService` (la classe s'appelle `QRService`) -> corrigé ; il ne collecte toutefois aucun test pytest (script). `test_fixes_ownership_loyalty.py` teste l'échange points -> bon d'achat, **volontairement supprimé par la fidélité v3** : test obsolète, à réécrire pour v3, pas à réparer.

**Non traité**
- Passkeys pour commerçants / super-admin, puis suppression de `password_hash`, `must_change_password`, `ChangePasswordModal`, du mot de passe temporaire `DEFAULT_ADMIN_TEMP_PASSWORD` en dur dans `auth_service.py` et de la validation de mot de passe fort.
- Sessions : jeton client toujours dans `localStorage` et en clair en base (`customers.session_token`), session unique par client. Cookies HttpOnly + table `sessions` (rotation, appareil) = chantier CORS/authentification à part.
- Étape « Passkey » dans l'inscription (le compte est créé par `quick-register`, la Passkey se configure ensuite depuis le profil), et `REQUIRE_LOGIN_OTP` toujours à `true` par défaut (le prompt demande `false`) : changement de comportement à décider.
- Rien n'a été testé sur un vrai appareil (empreinte / Face ID) : les tests utilisent un authentificateur logiciel. Un essai HTTPS réel avec `PASSKEY_RP_ID` et `PASSKEY_ORIGINS` configurés reste nécessaire.

### 8 bis. Complément
- **Mot de passe temporaire public (critique)** : `ensure_default_owner_credentials` donnait à tout commerçant sans mot de passe la valeur publique `AwaChic2026!`. Hors développement (`APP_ENV != dev`), le mot de passe temporaire est désormais aléatoire (12 caractères + suffixe, conforme aux règles de mot de passe fort) ; `reset_to_default_credentials` le retourne et la route de réinitialisation super-admin l'affiche une seule fois (`temporary_password`). En dev, comportement inchangé (tests). Test ajouté : **74 réussis, 1 ignoré.**
- **Session client non durcie volontairement** : `Customer.session_token` sert aussi de preuve de propriété sur les commandes (`orders.customer_token`, chat, abonnements). Le hacher ou le faire expirer demande de migrer ces comparaisons ensemble : à faire dans le chantier cookies HttpOnly + table `sessions`.


## Session passkeys — corrections
- `REQUIRE_LOGIN_OTP` : défaut `false` (config + `.env.example`).
- Réinitialisation du mot de passe de sécurité commerçant : `POST /auth/password-reset/request` (OTP 6 chiffres envoyé par WhatsApp, haché, 10 min, 5 essais, usage unique, réponse identique si le compte n'existe pas) puis `POST /auth/password-reset/confirm` (mot de passe fort, sessions fermées).
- Super-admin : `POST /super-admin/owners/{id}/reset-credentials` → mot de passe temporaire + message à copier + lien `wa.me`.
- Tests : `tests/test_password_reset.py` (76 tests verts au total).

## Reste à faire (chantiers dédiés)
1. **Passkeys Owner/SuperAdmin** : `PasskeyCredential.customer_id` est non nul et lié à `customers` ; il faut un `subject_type` + `subject_id`, adapter `PasskeyService`, puis retirer `password_hash`, `ChangePasswordModal` et la validation de mot de passe fort (le mot de passe de sécurité optionnel ci-dessus reste la voie de repli).
2. Webhook WhatsApp réel (`WHATSAPP_WEBHOOK_URL`) non testé.

## Session client + frontend — corrections
- **Session client** : `Customer.session_token` est stocké haché (`h1$…`) avec `session_expires_at` (`CUSTOMER_SESSION_TTL_DAYS`, 30 j). Le jeton brut n'existe que dans un **cookie HttpOnly** (`gs_customer`, `SameSite=Lax`, `Secure` hors dev). Migration automatique : colonne ajoutée, jetons existants hachés, expiration posée ; les sessions actives restent valides.
- Toutes les comparaisons passent par `CustomerService` (`get_by_token`, `token_matches`, `effective_token`) : commandes, preuve de propriété (`order_access`), chat, abonnements, coupons, passkeys. Présenter une empreinte `h1$…` est refusé.
- Un middleware ASGI convertit le cookie en en-têtes et pose/efface le cookie ; le frontend n'envoie que le marqueur non secret `__cookie__`, remplacé côté serveur. `POST /customer/logout` révoque la session et efface le cookie.
- `Order.customer_token`, conversations et historique ne stockent plus de jeton de session (seulement les jetons invités `guest_…`, propres à une commande). Le jeton n'est plus renvoyé dans le corps des réponses (`CUSTOMER_TOKEN_IN_BODY=false` par défaut ; `true` = compatibilité).
- **Frontend** : `credentials: "include"` sur les appels API, marqueur de session, déconnexion serveur, écran « Mot de passe oublié ? » (OTP WhatsApp → nouveau mot de passe) dans `LoginModal`, bouton « Réinitialiser » (mot de passe temporaire, copie du message, lien WhatsApp) dans `SuperAdminDashboard`.
- Tests : `tests/test_customer_cookie_session.py` ; 80 tests verts. `vite build` OK, 0 erreur de lint.

### Points d'attention
- Un ancien jeton brut resté dans le `localStorage` d'un navigateur reste accepté jusqu'à sa prochaine connexion (puis remplacé par le marqueur) ; il expire avec la session.
- Si l'API est servie depuis un autre site que le frontend : `CUSTOMER_COOKIE_SAMESITE=None`, HTTPS obligatoire, et l'origine doit figurer dans `CORS_ORIGINS`.
- Les scripts racine `test_fixes_ownership_loyalty.py`, `test_backend.py`, etc. échouaient déjà à l'identique avant ces changements (non pytest).
