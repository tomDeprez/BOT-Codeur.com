# Suivi de Projet - Bot Codeur.com

**Date :** 18 octobre 2025

## Objectif du Projet

Créer un bot automatisé pour le site `codeur.com`. Le bot doit pouvoir, à terme, répondre aux appels d'offre et aux messages des clients en utilisant une intelligence artificielle locale (via Ollama) et être configurable via une interface web.

---

## Où nous en sommes : Phase 1 (Terminée)

Nous avons terminé la mise en place de l'infrastructure de base et la partie configuration du bot.

**Tâches accomplies :**

- [x] **Infrastructure Docker :**
  - Création d'un `docker-compose.yml` pour gérer deux services :
    1. `ollama_service` : pour l'IA locale.
    2. `webapp_service` : pour l'application Node.js.
  - Résolution des problèmes de démarrage du conteneur (erreur `module not found` due au montage de volume).

- [x] **Interface de Configuration (Frontend) :**
  - Création d'une page `index.html` avec Bootstrap.
  - Le formulaire permet de configurer le bot en utilisant un **cookie de session** (plus sécurisé) et des **prompts** pour les réponses.

- [x] **Serveur de Configuration (Backend) :**
  - Le serveur Node.js (`index.js`) expose une API (`/api/config`).
  - Le clic sur "Sauvegarder" envoie la configuration au serveur, qui la stocke dans un fichier `config.json`.

- [x] **Test de Connexion à Codeur.com :**
  - Création d'un script `bot.js` qui lit le `config.json`.
  - Ce script effectue avec succès une requête authentifiée (avec le cookie) à la page `/messages` de `codeur.com` et affiche le HTML dans les logs.

---

## Prochaines Étapes

Maintenant que nous pouvons nous connecter et récupérer des pages, nous devons analyser ce contenu et le donner à l'IA.

- [ ] **Phase 2 : Analyse et Extraction des Données**
  - [ ] **Analyser le HTML** de la page des messages pour trouver comment identifier les messages non lus et leur contenu.
  - [ ] **Ajouter une librairie de parsing HTML** (comme `cheerio`) pour extraire facilement ces informations.
  - [ ] Faire la même chose pour la page des **appels d'offre** afin d'en extraire les détails.

- [ ] **Phase 3 : Intégration avec Ollama**
  - [ ] Envoyer le texte extrait (contenu d'un message ou détail d'une offre) à l'API d'Ollama (`http://ollama_service:11434`).
  - [ ] Construire la requête en utilisant le **prompt** correspondant sauvegardé par l'utilisateur.
  - [ ] Récupérer la réponse texte générée par le modèle de langue.

- [ ] **Phase 4 : Action du Bot (Réponse)**
  - [ ] Identifier comment envoyer une réponse sur `codeur.com` via une requête HTTP.
  - [ ] Implémenter la logique pour poster la réponse générée par Ollama.

- [ ] **Phase 5 : Finalisation**
  - [ ] Mettre en place une boucle (`setInterval`) pour que le bot s'exécute automatiquement toutes les X minutes.
  - [ ] Améliorer l'affichage du statut sur l'interface web pour donner plus de détails.
