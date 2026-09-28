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
