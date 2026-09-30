# Corrections apportées — Audit GotoShop

## 1. `backend/app/services/order_service.py` (critique)
**Bug :** `OrderService.list_orders` filtrait avec `if customer_id ... elif customer_token ...`.
Dès qu'un client était identifié (`customer_id` connu), le filtre par `customer_token`
était totalement ignoré. Toute commande passée en tant qu'invité (guest checkout,
uniquement `customer_token`, sans `customer_id`) devenait invisible une fois le client
connecté/inscrit — alors qu'elle existait bien en base.
**Correctif :** les deux critères sont désormais combinés avec un `OR` (comme le fait déjà
`CustomerService.get_customer_orders` ailleurs dans le code), plus l'import `or_` de SQLAlchemy.

## 2. `frontend/src/components/ConversationalOrderModal.jsx`
**Bug :** un écran de confirmation complet (récap commande, statut, bouton "Ouvrir le chat")
était codé mais jamais affiché : `handleSubmitOrder` appelait `onClose()` immédiatement après
la création de la commande au lieu de `setStep("SUCCESS")`.
**Correctif :** l'écran de succès est maintenant réellement affiché ; `onOrderCreated` est
toujours déclenché en tâche de fond pour rafraîchir les compteurs/onglets.

## 3. `frontend/src/components/CommandesPage.jsx` (espace marchand)
**Bug :** la liste des commandes n'était chargée qu'au montage du composant (`useEffect(..., [])`
sans intervalle), alors que le backend diffuse un évènement WebSocket `order.created` que rien
côté front n'écoute sur cette page. Un marchand resté sur l'onglet "Commandes" ne voyait donc pas
les nouvelles commandes sans rafraîchir manuellement.
**Correctif :** ajout d'un rafraîchissement automatique toutes les 20s (`setInterval`), en
attendant une vraie intégration WebSocket dédiée aux commandes.

## 4. `frontend/src/App.jsx` (cohérence des redirections)
**Bug :** plusieurs navigations internes utilisaient `setActiveTab(...)` directement au lieu de
`handleSelectTab(...)`, qui est la seule fonction à synchroniser le paramètre `?tab=` dans l'URL
(via `history.pushState`). Résultat : après fermeture du chat, de la page Commandes client, des
Stats, ou de l'écran de confirmation, l'URL restait désynchronisée du contenu affiché — bouton
"retour" du navigateur et partage de lien cassés à ces endroits.
**Correctif :** remplacement de `setActiveTab("boutique"/"commandes")` par `handleSelectTab(...)`
dans les callbacks de fermeture/navigation suivants (bas risque, hors flux login/logout) :
- `ClientCommandesPage.onNavigateToShop`
- `ChatPage.onClose` et `ChatPage.onNavigateToOrder`
- `StatsPage.onNavigateToCatalog`
- `ClientStatsPage.onNavigateToShop`
- `ConfirmTokenPage.onBackToStore`

## Points identifiés mais non modifiés (à valider avec vous)
- Une **vingtaine** d'autres appels directs à `setActiveTab` subsistent dans les flux
  login/logout/switch-store (`handleLoginSuccess`, `handleLogout`, `handleSwitchStore`, etc.).
  Je ne les ai pas touchés car ces fonctions gèrent déjà elles-mêmes leur propre `pushState`
  (paramètres `store`/`view`) : les modifier sans pouvoir lancer l'application risquerait de
  créer des doublons d'historique ou des conflits de paramètres d'URL.
- `CommandesPage.jsx` gagnerait à terme à écouter directement le WebSocket déjà diffusé par le
  backend (`manager.safe_broadcast_sync(..., {"type": "order.created", ...})`) plutôt qu'un
  simple polling — non fait ici pour rester sur un correctif ciblé et sans risque.

## 5. Refonte de l'en-tête boutique (couverture, photo ronde, statut ouvert / en ligne)
- `frontend/src/components/StoreHeader.jsx` (NOUVEAU) : logo de la boutique en photo de couverture, photo de profil
  ronde superposée (photo du client en visite, photo du propriétaire dans sa propre boutique, initiales sinon),
  bandeau « Vous êtes dans la boutique / votre boutique », statut « Boutique ouverte • En ligne » /
  « Vendeur hors ligne » / « Boutique fermée », statistiques (note, ventes, abonnés), canaux de discussion.
  Vue propriétaire : bouton Ouvrir/Fermer la boutique + envoi d'un signal de présence toutes les 30 s.
- `frontend/src/components/VitrinePage.jsx` : utilise StoreHeader à la place de l'ancienne carte.
  Corrigé au passage : le numéro WhatsApp factice « 22670123456 » n'est plus affiché quand la boutique n'en a pas,
  et « Vendeur en ligne » n'est plus codé en dur.
- `frontend/src/api/client.js` : fetchStoreStatus, sendOwnerHeartbeat, setStoreOpen.
- Backend : colonnes `is_open` et `owner_last_seen_at` (modèle + migration automatique), champs `is_open`,
  `is_owner_online`, `city`, `country` dans le schéma boutique, routes `GET /store/{id}/status`,
  `POST /store/{id}/presence`, `PUT /store/{id}/open` (ces deux dernières exigent un jeton propriétaire).
  Le vendeur est « en ligne » s'il a émis un signal dans les 90 dernières secondes.

## Constats à traiter (non modifiés)
- SÉCURITÉ : `require_store_admin` (routers/auth.py) retourne `None` quand aucun jeton n'est fourni
  ("dev fallback") : n'importe qui peut donc modifier une boutique via `PUT /store/{id}`. À supprimer en production.
- QR code : `qr_service.py` et `utils/qrGenerator.js` dessinent une matrice « simulée » qui n'est PAS un vrai QR
  code (non scannable). Il faut un vrai encodeur QR avant de travailler la carte de fidélité et l'export PDF.

## 6. Sécurité : fin du « dev fallback » (backend + frontend)
- `routers/auth.py` : `require_store_admin` renvoyait `None` sans jeton, donc n'importe qui pouvait modifier une
  boutique. Désormais : pas de jeton → 401, jeton invalide → 401, boutique inconnue → 404, boutique d'un
  autre commerçant → 403 (le SuperAdmin passe toujours).
- `POST /auth/reset-credentials` était public (réinitialisait le mot de passe du 1er propriétaire et renvoyait
  le mot de passe par défaut). Réservé au SuperAdmin.
- Actions vendeur qui n'avaient AUCUNE garde, maintenant réservées au propriétaire de la boutique concernée :
  accepter/refuser une commande, confirmer/refuser un paiement, changer le statut (`routers/orders.py`),
  liste/fiche/modération/avantages des clients (`routers/customer.py`, qui modifiait aussi la boutique par défaut
  au lieu de celle du client), publication d'annonces (`store_subscriptions.py`), création de produit sans boutique
  cible (`catalog.py`).
- `frontend/src/api/client.js` : ces appels envoient maintenant le jeton (`ownerJsonHeaders`), y compris les paliers
  de fidélité qui l'oubliaient.
- Testé sur la base fournie : sans jeton 401, jeton d'un autre commerçant 403, propriétaire 200, lecture publique 200.
- Reste ouvert (non modifié) : routes de chat, d'appels, d'intentions (`commerce.py`), de notifications et les
  actions client sur les commandes se basent sur des identifiants devinables sans preuve de propriété.

## 7. Vrai QR code (ISO 18004), scannable
- `backend/app/services/qr_encoder.py` et `frontend/src/utils/qrEncoder.js` (NOUVEAUX) : encodeur QR complet,
  versions 1 à 40, correction d'erreur L/M/Q/H, sans dépendance. Les deux versions produisent des matrices identiques
  (106 cas comparés). Décodage vérifié avec zxing-cpp sur 47 combinaisons (versions 1 à 36) : 0 échec.
- `backend/app/services/qr_service.py` et `frontend/src/utils/qrGenerator.js` : l'ancien dessin factice est remplacé.
  L'URL encodée est celle du domaine réellement utilisé (`/store/<slug>`), plus `gotoshop.com` codé en dur.
- `frontend/src/components/StoreQrModal.jsx` : génère le QR localement (instantané, hors ligne).
- Corrigé : l'affiche A4 produisait un SVG invalide si le nom de boutique contenait `&` ou `<`.
- `backend/tests/test_qr_encoder.py` : test de relecture par décodage.


## 6. Audit base de données et enregistrements (voir AUDIT_GOTOSHOP.md)
- `backend/app/services/order_service.py` : client borné à la boutique + preuve de propriété, prix/frais/stock côté serveur, libération unique stock/coupon/intention, transitions finales verrouillées, points selon la boutique.
- `backend/app/services/customer_service.py`, `schemas/customer.py` : clients par boutique, unicité du téléphone.
- `backend/app/migrations.py` : rattrapage FIFO corrigé, index d'unicité.
- `backend/tests/` : `conftest.py` (base jetable), `test_integrity_orders.py` (nouveau), `test_customer_order_auth.py` (prix serveur).
- `backend/audit_db.py`, `backend/repair_db.py` (nouveaux).
- Second passage : `database.py` (repli SQLite opt-in, FK opt-in), `config.py` (simulateur, alertes secrets), verrous de ligne stock/coupon, téléphone normalisé, `.gitignore`.

## 6 bis. Troisième passage (audit §4 bis)
- **Frais de livraison** : `delivery_cities.delivery_fee` (nouveau, migration) ; `OrderService._resolve_delivery_fee` impose le tarif de la ville, sinon borne la valeur client à `MAX_UNCONFIGURED_DELIVERY_FEE` (5000).
- **OTP à la connexion téléphone** : `POST /customer/login/otp/request`, champ `otp_code` sur `quick-login` / `quick-register`, exigé si `REQUIRE_LOGIN_OTP=1` (désactivé par défaut). Code à usage unique.
- **Jetons commerçant / super-admin hachés** (`core/security.py` : `hash_session_token`, `lookup_hash`) ; migration des jetons existants (sessions actives conservées) ; une empreinte présentée comme jeton est refusée.
- **Accès de démonstration coupé par défaut** : mots de passe maîtres, alias `demo`/`admin`, `demo_login`, jetons `demo_owner_token_<slug>` -> `ALLOW_DEMO_ACCESS=1` (local uniquement).
- **`backend/cleanup_db.py`** (nouveau, simulation par défaut) : `--merge-phones` (D7), `--purge-test-wallet [--purge-pending-withdrawals]` (D6), `--credit-delivered-points` (D3).
- **Tests** : `test_conversational_commerce.py` migré dans `tests/` (jeton vendeur, jeton renvoyé par le serveur, OTP réel) ; `conftest.py` réassortit le stock de la copie jetable ; nouveaux `test_delivery_fee_and_login_otp.py`, `test_owner_tokens.py`. 24 tests réussis.

## 6 ter. Quatrième passage (audit §4 ter)
- **OTP persistant** : `models/otp.py` (table `otp_codes`), `services/otp_service.py` réécrit (base de données, HMAC, `secrets`), `services/sms_service.py` (webhook / Twilio), variables `SMS_PROVIDER`, `SMS_WEBHOOK_URL`, `SMS_WEBHOOK_TOKEN`, `TWILIO_*` dans `config.py`. Clé OTP de connexion indépendante de la boutique.
- **Frontend OTP** : `api/client.js` (`requestCustomerLoginOtp`, erreurs OTP sans repli local), `CustomerAuthModal.jsx` (saisie du code).
- **Tarifs de livraison** : routes `/store/{id}/delivery-cities` (`routers/store.py`), `DeliveryCitiesSection.jsx` dans `ReglagesPage.jsx`, fonctions `fetchDeliveryCities` / `saveDeliveryCity` / `deleteDeliveryCity`.
- **Tests** : `test_e2e.py` -> `tests/test_e2e_legacy.py` (ignoré, motif écrit), `test_smoke_api.py`, `test_delivery_cities_admin.py`. 35 réussis, 1 ignoré.

## 6 quater. Cinquième passage (audit §4 quater)
- **Anciens scripts `backend/test_*.py`** (point 5) : nouveau `backend/conftest.py` qui redirige TOUTE la suite pytest (y compris ces scripts) vers une copie jetable de la base ; `tests/conftest.py` réutilise cette isolation (variable `GOTOSHOP_TEST_ISOLATED`). Lancés directement avec `python test_x.py` (hors pytest), ils écrivent encore sur la base réelle : utiliser `python -m pytest`.
- **OTP dans les modales de commande** (point 1) : `TunnelHandoffModal` et `ConversationalOrderModal` suivent le même chemin (échec de `quick-register` -> ouverture de `CustomerAuthModal`, qui gère le code SMS) ; message explicite « Vérification par SMS requise » quand le serveur exige un code. Vérifié par lecture du code uniquement.
- **Non traité** : jetons clients hachés (refonte identifiant/secret, cf. audit), réécriture des flux de `test_e2e_legacy.py`, tests PostgreSQL / navigateur / SMS réel. Aucun test n'a pu être exécuté dans cet environnement (pas d'accès réseau pour installer pytest/fastapi).

## 7. Accueil des boutiques : effet immersif (StoreExplorerPage.jsx, index.css)
- **Bordures 3D en relief** : classes `gs-3d-panel`, `gs-3d-panel-sm`, `gs-3d-btn` (s'enfonce au clic), `gs-3d-inset` (champ de recherche creusé) sur le hero, les 3 piliers, les boutons, les puces de filtre et les cartes boutique. Thème clair et sombre.
- **Hero collant + flou progressif** : le hero reste en place et se floute (voile `backdrop-filter`, variable `--gs-p` liée au défilement) et rétrécit légèrement pendant que le panneau des boutiques (`gs-sheet`, coins arrondis) remonte par-dessus. Hero plus haut que l'écran : il défile d'abord jusqu'à ce que son bas touche le bas de l'écran.
- **Dock recherche** : barre de recherche + filtres pays + compteur (`gs-dock`) se collent sous le header, au-dessus du hero flouté, avec ombre marquée une fois collés ; ils se libèrent en fin de liste.
- **Indice de défilement** : bouton « Descendez pour découvrir les boutiques » (pulsation + flèche animée), poignée en haut du panneau ; animations coupées avec `prefers-reduced-motion`.
- Non testé dans un navigateur (pas de `node_modules` ni de réseau ici) : syntaxe JSX vérifiée par le compilateur TypeScript, balises équilibrées. À contrôler visuellement : hauteur du header (65 px codée en dur dans `--gs-header-h`), rendu mobile, performance du flou sur mobiles bas de gamme.

## 8. Vérification du passage de commande (revue statique)
- `create_order` : le `variant_id` est désormais restreint au produit commandé (un variant d'un autre produit ou d'une autre boutique ne peut plus imposer son prix). Compilation de tout le backend OK. Aucune exécution réelle possible dans la session (fastapi / sqlalchemy / pytest non installés, pas de réseau) : à valider avec `python -m pytest -q tests`.

## 9. Deuxième revue des commandes (statique)
- **GET /orders sans authentification** : n'importe qui pouvait lister toutes les commandes d'une boutique (noms, téléphones, adresses) avec `?store_id=`, ou celles d'un client avec `?customer_id=` seul. Maintenant : jeton client valide, ou jeton du commerçant propriétaire de la boutique (`fetchConversationalOrders` envoie le jeton commerçant). `customer_id` seul ne suffit plus.
- **Paiement Mobile Money factice** : `pay-mobile-money` marquait la commande PAID et créditait le portefeuille vendeur sans appeler aucune passerelle (et `is_test_mode` venait du client). Désormais refusé hors `PAYMENT_SIMULATOR` ; refusé aussi si la commande est déjà payée ou annulée. Le paiement par preuve + confirmation vendeur reste actif.
- **Prix d'un article hors catalogue** : un `unit_price` absent était transformé en 1 FCFA ; il reste vide (donc 0) et n'est plus inventé.
- **Non traité (à décider)** : `GET /orders/{id}`, `payment-proof`, `payment-proof-upload`, `request-otp` ne vérifient pas le propriétaire (protégés seulement par l'UUID de la commande) ; l'ajout d'un jeton client obligatoire demande de modifier le frontend. Non exécuté : aucun test lancé (dépendances absentes).

## 10. Revue fidélité et carte (statique)
- **Coupon invalide ignoré en silence** à la création de commande : le client payait plus que le prix affiché. Maintenant : erreur explicite (expiré, réservé au titulaire, montant minimum...).
- **Coupon consommé entre-temps** (course) : la remise était quand même accordée. Maintenant la commande est refusée avec un message clair.
- **Remise de palier** : calculée avec les paliers par défaut (3/5/8 %) au lieu des paliers configurés par la boutique (ceux de la carte). Corrigé ; un `discount_percent` nul ne fait plus échouer la commande.
- **Vérification de carte** : limitation de débit sur l'IP réelle (`X-Forwarded-For`) ; derrière un proxy, tous les visiteurs partageaient jusqu'ici le même quota de 30 vérifications/minute.
- **Non modifié, à décider** : (a) les points affichés (`get_customer_stats` : max entre solde et dépenses/point) peuvent dépasser le solde réellement rachetable (`bonus_points`) pour les commandes livrées jamais créditées (cf. D3) ; (b) les points à la livraison utilisent `max(1, total/seuil)` (1 point minimum) alors que l'affichage utilise la division entière, et le total inclut les frais de livraison ; (c) `CARD_SIGNING_KEY` doit être défini en production, sinon la clé dérive de la configuration et change si elle change (toutes les cartes imprimées deviendraient invalides).
- Carte 3D : lecture de `cardScene.js` (couleurs nulles, QR, paliers) sans défaut trouvé ; rendu non vérifié dans un navigateur.

## Remises par produit ou par catégorie (filtrées par public)
**Ajout :** une remise boutique peut maintenant porter sur **toute la commande** (comportement d'avant), sur des
**produits choisis** ou sur des **catégories choisies**. Le **public** (Tous / Clients inscrits / Visiteurs / Clients
choisis) reste le filtre : une remise produit ou catégorie ne s'applique qu'au public choisi, et seulement sur les
lignes concernées du panier.
- `models/store.py`, `migrations.py` : colonnes `scope`, `product_ids`, `category_ids` sur `store_discount_rules`
  (ajoutées automatiquement au démarrage ; les règles existantes deviennent `STORE`, aucun changement pour elles).
- `services/discount_service.py` : calcul sur les lignes éligibles ; une seule remise s'applique, la plus forte
  **en montant** (avant : en pourcentage) ; validation (produits/catégories de la boutique uniquement).
- `services/order_service.py`, `routers/orders.py` : la commande et l'aperçu (`POST /orders/shop-discount`,
  champ optionnel `items`) utilisent les lignes du panier. Le montant est calculé côté serveur.
- Front : `DiscountRulesSection.jsx` (choix « Sur quoi ? » + sélecteurs produits/catégories),
  `ConversationalOrderModal.jsx` (montant renvoyé par le serveur), `api/client.js`. `frontend/dist` reconstruit.
- Tests : `backend/tests/test_scoped_discounts.py` (7 tests, dont commande de bout en bout).
Règle inchangée : la « commande min. » se compare au sous-total de toute la commande.

## Publicité de produit : partage sur tous les réseaux + résultats mesurés
**Ajout :** un produit peut être partagé sur n'importe quel réseau avec **un lien suivi par produit et par réseau**
(WhatsApp, Facebook, Instagram, TikTok, Telegram, X, Snapchat, LinkedIn, SMS, e-mail, QR/affiche, autre). Chaque lien
mesure l'entonnoir : **clics → vues du produit → intentions → commandes → achats + chiffre d'affaires**.
- Lien partagé = page d'aperçu (`/api/analytics/share-page/<code>`) : photo, nom et prix s'affichent dans WhatsApp,
  Facebook, Telegram… puis redirection vers la boutique (`?store=…&c=<code>&src=<réseau>`). Le client arrive avec un
  bandeau « Produit recommandé » (bouton Commander).
- Vues/intentions/clics : événements dédoublonnés par visiteur (30 min). **Commandes et achats ne sont pas des compteurs** :
  ils sont recalculés depuis les vraies commandes (`orders.share_code`, `order_intents.share_code`) ; achat = paiement
  confirmé (ou intention vendue) ; commandes annulées/rejetées exclues ; chiffre d'affaires = lignes du produit promu seulement.
- Attribution : dernier lien cliqué (7 jours), seulement si la commande contient le produit promu. Un code d'une autre
  boutique ou inconnu est ignoré sans bloquer la commande.
- Back : `models/analytics.py` (`ProductShareLink`, colonnes `share_code`/`visitor_id`), `migrations.py` (colonnes ajoutées
  au démarrage), `services/share_ad_service.py`, `routers/analytics.py` (`/analytics/{store}/share-links`, `/share-stats`,
  `/share-event`, `/share-link/{code}`, `/share-page/{code}`), `order_service.py`, `commerce_service.py`.
- Front : `ProductShareModal.jsx` (bouton « Promouvoir sur les réseaux » sur chaque produit de la vitrine),
  `ProductAdsSection.jsx` (tableau de bord Statistiques), `SharedProductBanner.jsx`, `utils/shareAttribution.js`, `api/client.js`, `App.jsx`.
- Tests : `backend/tests/test_share_ads.py`.
Limites : Instagram, TikTok et Snapchat n'ont pas de bouton de partage web → le lien est copié pour la bio/story ;
les autres tableaux « Analytics » du tableau de bord restent des données de démonstration (non modifiés).

## 30/09/2026 — Correctifs de l'audit (AUDIT_BUGS_PLATEFORME.md)
Appliqués (non exécutés en test : dépendances Python indisponibles dans l'environnement de correction — lancer `pytest backend/tests/test_audit_auth_fixes.py`) :
- C1 : `/api/intents` feed / pending-followup / discrepancies / confirm / archive / delete / resolve-discrepancy exigent un jeton commerçant propriétaire de la boutique (`client-action` avait déjà `verify_order_access`).
- C2 : notifications (liste, read, read-all, delete, decision-insights) : jeton commerçant (sa boutique) ou client (ses notifications).
- C3 : conversations, messages, médias, lecture, appels et WebSocket : contrôle de participation (commerçant de la boutique, client propriétaire ou jeton invité `X-Customer-Token`).
- C4/M4 : `REQUIRE_LOGIN_OTP=true` par défaut ; limitation de débit (`core/ratelimit.py`) sur quick-login, quick-register, track-visit.
- C5 : extension déduite du type validé + octets magiques + `nosniff`/CSP/`Content-Disposition` sur `/media`.
- C6 : `GET /api/orders/{id}` réservé au client propriétaire (jeton) ou au vendeur.
- E1 : statistiques calculées sur les données réelles (0 si aucune) ; `/analytics/overview` protégée.
- E2 : décrément de stock atomique (`UPDATE … WHERE stock >= qty`).
- E3 : constante importée ; le mot de passe par défaut n'est plus renvoyé.
- E4 : seed uniquement si `SEED_DEMO_DATA` (défaut : SQLite local).
- M1 : CORS restreint (`CORS_ORIGINS`, `FRONTEND_URL`, localhost hors production). M2 : 404 JSON sous `/api`. M6 : plus de `OTP_SECRET` public en production.
- Frontend : `client.js` envoie les jetons sur les routes ci-dessus.
Non traités : M3, M5, F1–F4, F5 ; `by-reference` / `batch-lookup` restent publics.

### Suite (30/09/2026)
- `intents/by-reference` et `batch-lookup` : vue publique **expurgée** (statut seulement, sans nom/téléphone/position/avis) ; données complètes pour le vendeur ou le détenteur de la preuve client (`X-Customer-Token`) ; limités en débit (30/min/IP), 50 identifiants max.
- M3 : routes montées à la racine uniquement sur Vercel (`VERCEL` défini), masquées du schéma OpenAPI.
- M5 : SVG de la carte : texte échappé (`esc`), `href` d'image limité à `data:image/(png|jpeg|webp|gif);base64`; SVG du QR : titre échappé, couleurs constantes (vérifié, pas de faille). Jetons toujours en `localStorage` (voir « Non traité »).
- F4 : plus de repli `localhost:8000` en build de production (`/api` relatif).
- Tests historiques : `backend/conftest.py` injecte un jeton super-admin de test sur les routes désormais protégées (sauf `test_audit_auth_fixes.py`).
- Non traité : F1 (189 avertissements oxlint), F2 (découpage des gros composants), F3 (`utcnow`), F5, jetons en cookie HttpOnly.


## 7. Sixième passage
- `routers/calls.py` : import `CallSession` corrigé ; `/calls/history` refuse l'anonyme (401/403).
- F5 : `routers/store.py` (`_spot_gps_check`, `_spot_response`, latitude+longitude ensemble), `DeliverySpotsSection.jsx` (champs GPS, bouton position, alerte).
- F3 : `app/core/clock.py` + remplacement de `datetime.utcnow()` dans 45 fichiers.
- F1 : `oxlint --fix` / `--fix-suggestions` (191 -> 122 avertissements).
- Réappliqué : tarif de ville dans `TunnelHandoffModal.jsx` ; `_bind_store` dans `routers/customer.py` et en-tête `X-Store-Slug` dans `api/client.js`.
- Tests : `tests/test_spot_gps_and_clock.py`. 64 réussis, 1 ignoré.
