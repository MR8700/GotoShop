# ConversaStore Mobile Engine

Moteur de boutiques individuelles orientées vers la conversation et le commerce social (WhatsApp, Messenger, TikTok, Appel/SMS), avec suivi des intentions d'achat, arbitrage 24h post-conversation, confirmation bilatérale client-commerçant, gestion des incohérences de vente, et incitation à l'adhésion fidélité VIP.

---

## 1. Principes Directeurs & Invariants Métier

1. **Mono-Propriétaire Réel :** Le client final n'a aucune perception de marketplace multi-vendeurs ; il entre directement dans la boutique exclusive de la commerçante (*Awa Chic & Tech*).
2. **Accès Public & Invité sans Friction :** Le client peut consulter l'intégralité du catalogue, passer commande, discuter sur les canaux sociaux et suivre ses commandes sans être connecté. Ses commandes sont mémorisées localement sur son appareil.
3. **Nudges de Conversion VIP (3s) :** Le système incite élégamment le client invité à s'inscrire en 3 secondes (nom + WhatsApp) pour sécuriser ses commandes sur le cloud, conserver ses coordonnées GPS et débloquer ses points de fidélité *Awa Club Privilège*.
4. **Zéro Mock / 100% Base de Données :** Aucune donnée, texte, prix, badge, image ou statistique n'est codé en dur dans le frontend. Tout est stocké dans la base relationnelle (`conversastore.db`), traité par le backend FastAPI, et servi de manière dynamique.
5. **Confirmation Bilatérale & Matrice de Cohérence Métier :**
   - Une redirection WhatsApp est une **intention d'achat**, pas une vente définitive.
   - Le client peut marquer sa commande comme **"Satisfait(e)"** (avec note 1 à 5 étoiles et avis) ou l'**"Annuler"** avec motif.
   - La commerçante est notifiée pour confirmer si la transaction s'est réellement conclue en magasin ou par livraison.
   - Le système détecte et arbitre automatiquement les incohérences (ex: commerçante déclarant la vente conclue mais client ayant annulé) pour garantir l'intégrité absolue des stocks et du chiffre d'affaires.

---

## 2. Matrice de Cohérence & Moteur d'Arbitrage

Le système intègre un moteur d'intégrité transactionnelle (`Coherence Matrix Engine`) reliant la déclaration de la commerçante et l'expérience vécue par le client :

| Déclaration Commerçante | Déclaration Client | État de Cohérence (`coherence_status`) | Impact Métier & Statistiques |
| :--- | :--- | :--- | :--- |
| En attente | En attente | `HARMONIZED_PENDING` | Intention en cours de discussion |
| En attente | **Satisfait(e)** ⭐ | `CLIENT_CONFIRMED_PENDING_MERCHANT` | Notification immédiate à la commerçante pour confirmer la vente réelle |
| En attente | **Annulé** ❌ | `CLIENT_CANCELLED_EARLY` | Notification à la commerçante pour éviter tout démarchage inutile |
| **Vente Conclue** | **Satisfait(e)** ⭐ | `CONSOLIDATED_SALE` | Vente 100% validée bilatéralement, chiffre d'affaires consolidé |
| **Vente Conclue** | **Annulé** ❌ | `DISCREPANCY_CONFLICT` ⚠️ | **Incohérence critique !** Chiffre d'affaires exclu du net, alerte d'arbitrage immédiate |
| **Abandon / Non Vendu** | **Satisfait(e)** ⭐ | `DISCREPANCY_SURPRISE` ⚠️ | Vente non anticipée, invitation à requalifier l'encaissement |
| **Abandon / Non Vendu** | **Annulé** ❌ | `MUTUAL_ABANDON` | Accord mutuel sur l'échec de la transaction |

### Arbitrage en 1 Clic des Incohérences
Dans le tableau de bord commerçante, les conflits sont signalés en tête de liste avec deux actions immédiates :
- **"Accepter l'annulation" :** Remise automatique du produit en stock et neutralisation du chiffre d'affaires.
- **"Maintenir vente conclue" :** Confirmation ferme avec archivage du motif ou de la preuve de livraison.

---

## 3. Écrans & Fonctionnalités Implémentés à l'Identique

| Écran / Composant | Rôle & Fonctionnalités Réelles |
| :--- | :--- |
| **1. Vitrine Boutique Client** (`/` ou onglet *Boutique*) | Header avec logo et profil commerçante, bandeau promo flash animé avec compte à rebours dynamique, carte commerçante vérifiée (4.9★, 342 ventes) avec **biographie authentique**, filtres de catégories, produit vedette avec variantes, flux de produits avec note vocale Awa, carte d'incitation VIP pour les invités, et *Thumb Bar* flottante avec panier interactif. |
| **2. Tunnel Handoff Client** (Déclenché par *Commander*) | Récapitulatif produit avec badge stock, référence unique (`#CMD-XXXXXX`), sélecteur de variantes, stepper quantité, ville, **partage en 1 clic de la position GPS exacte** (injectée dans le message social et prévisualisée sur Google Maps), 5 canaux conversationnels, mémorisation locale immédiate de la commande pour les invités, et **écran de confirmation VIP avec calcul des points gagnés et incitation à l'onboarding 3s**. |
| **3. Commandes Client (Invité & Connecté)** (onglet *Commandes*) | Liste en temps réel des commandes client. Pour chaque commande : statut actuel, lien Google Maps, bouton direct de relance WhatsApp, et boutons d'action bilatéraux : **"⭐ Marquer Satisfait(e)"** (modal interactif avec note 1-5 étoiles et commentaire) et **"❌ Annuler Commande"** (modal avec sélection de motifs d'annulation). Synchronisation en arrière-plan des commandes locales pour les invités. |
| **4. Commandes & Arbitrage Commerçante** (onglet *Commandes*) | **Cloche de notifications en temps réel** avec badge non-lu et tiroir d'alertes (avis client, annulations, alertes d'incohérence, relances 24h), **Section dédiée aux Incohérences** avec boutons d'arbitrage en 1 clic, carte de relance 24h avec badges client réels (*Satisfait* ou *Annulé*), et boutons réels **"OUI, VENTE CONCLUE"** et **"NON, ABANDON"**. |
| **5. Nouveau Produit Photo Instantanée** (*Modal Photo*) | Prise de vue directe par caméra mobile ou sélection d'image locale, redimensionnement instantané par Canvas HTML5, upload optionnel d'une vidéo démonstrative et d'un catalogue PDF, persistance dans la base et sur disque local `/media/`. |
| **6. Partager sur les Réseaux Sociaux** (*Modal Partage*) | Liens trackés multi-réseaux (TikTok Bio `?src=tiktok_bio`, Statut WhatsApp `?src=wa_status`, Post Facebook `?src=fb_post`, Instagram `?src=instagram`, QR Code) avec bouton "Tester Clic (+1)" simulant en temps réel l'impact sur l'entonnoir statistique. |
| **7. Statistiques & Taux de Clôture** (onglet *Stats*) | Filtres de périodes (*Aujourd'hui, 7 jours, Ce mois, Tout*), Chiffre d'Affaires encaissé avec courbe *Sparkline SVG*, entonnoir Visiteurs → Intentions → Ventes, comparateur de conversion par canal, **Bento Card "Satisfaction & Cohérence Réelle"** (Taux de satisfaction client, volume de clients satisfaits, annulations, litiges en cours et CA consolidé net), classement des Top Produits cliquables. |
| **8. Réglages Boutique** (onglet *Réglages*) | Gestion complète du profil commerçante (changement de photo de profil par caméra/upload avec compression dynamique, édition de la biographie), nom, slogan, devise, messages flash, et configuration fine des 5 canaux conversationnels. |
| **9. Espace Fidélité & Profil Client** (onglets *Avantages* & *Profil*) | Carte de fidélité digitale *Awa Club Privilège*, points cumulés calculés sur les ventes non-annulées, paliers Bronze/Silver/Gold VIP, remises flash, mémorisation permanente de la position GPS exacte et consignes livreur moto. |
| **10. Sécurité & Authentification Commerçante** | Connexion sécurisée PBKDF2-HMAC-SHA256 (120 000 itérations), protection anti-bruteforce (verrouillage 15 min après 5 échecs), changement de mot de passe obligatoire dès la première connexion avec validateur 7 critères à LED. |

---

## 4. Architecture Technique

- **Backend :** FastAPI (Python 3.13) + SQLAlchemy 2.0 + Pydantic v2 + SQLite relationnel (`conversastore.db`).
- **Migrations de Schéma :** Auto-migration idempotente au démarrage avec vérification `PRAGMA table_info` et `ALTER TABLE`.
- **Cryptographie & Sécurité :** PBKDF2-HMAC-SHA256 standard NIST, `secrets.token_urlsafe(32)`, regex anti-répétitions consécutives.
- **Frontend :** React 19 + Vite + Tailwind CSS (Thème sombre OLED *Kinetic Bazaar*, polices *Space Grotesk* et *Plus Jakarta Sans*, icônes *Material Symbols*).
- **Persistance Client Hybride :** Mémorisation locale `localStorage` pour le mode invité + synchronisation batch par API (`/api/intents/batch-lookup`) + rattachement instantané au compte cloud lors de l'inscription (`/api/customer/link-guest-orders`).
- **Média & Documents :** Stockage local des photos, vidéos et catalogues PDF dans `/media/`, servis dynamiquement.
- **Déploiement Unifié :** Le serveur FastAPI sert à la fois les API REST (`/api/...`), les médias (`/media/...`) et le bundle frontend compilé (`/`).

---

## 5. Démarrage Rapide

### Option A : Double-clic sur Windows
Double-cliquez sur [`run.bat`](file:///C:/dev/GotoShop/run.bat) à la racine du projet.

### Option B : Ligne de commande
```powershell
cd C:\dev\GotoShop\backend
python run_server.py
```
Ouvrez ensuite votre navigateur sur : **http://localhost:8000**
Documentation interactive de l'API : **http://localhost:8000/docs**

---

## 6. Identifiants Prédéfinis

- **Identifiant / Email par défaut :** `awa@chictech.bf`
- **Mot de passe initial :** `AwaChic2026!` (nécessite un changement vers mot de passe fort tel que `SikaTech#2026` à la première connexion).

---

## 7. Validation & Tests E2E Automatisés

La suite de tests E2E couvre **33 phases d'intégration complètes** avec zéro mock :
```powershell
cd C:\dev\GotoShop\backend
python test_e2e.py
```

### Détail des 33 Phases Validées :
1. **Phases 1 à 13 :** Vitrine, médias, catalogues, intentions WhatsApp/SMS, arbitrage 24h, mise à jour du CA et du stock, tracking social, upload photo/vidéo/PDF.
2. **Phase 14 :** Mise à jour dynamique de la photo de profil et de la biographie commerçante.
3. **Phase 15 :** Injection et transmission de la géolocalisation GPS exacte du client dans la discussion.
4. **Phases 16 à 18 :** Authentification sécurisée, rejet des mots de passe faibles, changement de mot de passe obligatoire.
5. **Phases 19 à 22 :** Inscription éclair client (3s), profil GPS, commandes rattachées, points de fidélité et paliers VIP.
6. **Phase 23 :** Enregistrement de la satisfaction client (5 étoiles) et passage en `CLIENT_CONFIRMED_PENDING_MERCHANT`.
7. **Phase 24 :** Notification automatique envoyée à la commerçante pour rappeler de valider la vente.
8. **Phase 25 :** Consolidation bilatérale (`CONSOLIDATED_SALE`) suite à la confirmation de vente par la commerçante.
9. **Phase 26 :** Annulation d'une commande par le client avec motif et alerte immédiate de la commerçante.
10. **Phase 27 :** Détection automatique d'un conflit d'incohérence (`DISCREPANCY_CONFLICT` : commerçante = VENDU, client = ANNULÉ).
11. **Phase 28 :** Consultation de la liste des incohérences via `/api/intents/discrepancies`.
12. **Phase 29 :** Résolution d'incohérence par arbitrage commerçante (`ACCEPT_CANCELLATION`), remise automatique en stock (+1) et déduction du CA.
13. **Phase 30 :** Requête par lot des commandes invitées (`/api/intents/batch-lookup`).
14. **Phase 31 :** Liaison automatique des commandes invitées au compte client suite à l'onboarding 3s (`/api/customer/link-guest-orders`).
15. **Phase 32 :** Consultation et acquittement groupé des notifications commerçante (`/api/notifications/read-all`).
16. **Phase 33 :** Calcul et intégrité des métriques d'analytique globale (Taux de satisfaction, litiges, CA consolidé net).
