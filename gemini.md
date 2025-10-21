# Suivi de Projet - Bot Codeur.com

**Date :** 21 octobre 2025

## Objectif du Projet

Créer un bot automatisé, testé et robuste pour le site `codeur.com`, contrôlable via une interface web.

---

## Principes de Développement

- **La Qualité par les Tests :** Chaque nouvelle fonctionnalité doit être accompagnée de tests (unitaires ou d'intégration). La suite de tests complète (`npm test`) doit impérativement passer avec succès avant que le développement de la fonctionnalité soit considéré comme achevé.

---

## Où nous en sommes

### Phase 1 : Infrastructure et Configuration (Terminée)

- [x] **Infrastructure et Configuration de Base :** Docker, UI V1, Config V1.
- [x] **Améliorations de l'Interface (V2) :** Refonte visuelle, vérification de connexion.
- [x] **Refactorisation de la Configuration (V3) :** 4 prompts, `auth.json`, `prompts.json`.

### Phase 2 : Analyse des Données et Tests (Terminée)

- [x] **Mise en Place des Tests :** Installation et configuration de Jest/Supertest. Tests pour l'API de configuration (`/api/config`).
- [x] **Analyse des Données :**
  - [x] Extraction des conversations.
  - [x] Extraction des projets avec gestion d'état (statuts "pas visité", "visité").
  - [x] Le bot scrape les détails (titre, budget, etc.) des nouveaux projets.
  - [x] La base de données des projets (`projects.json`) est mise à jour de manière persistante.
- [x] **Tests de la Logique Bot :** Rédaction de tests pour `runBotLogic`, simulant les appels réseau et la gestion des fichiers pour valider le cycle de vie des projets.
- [x] **Interface Utilisateur :** Affichage des conversations et de la liste détaillée des projets avec leur statut. Ajout d'un bouton pour vider le cache des projets.

---

## Prochaines Étapes

La collecte de données est maintenant robuste et testée. Nous passons à l'intelligence artificielle.

- [x] **Phase 3 : Intégration avec Ollama**
  - [x] Modifier la logique du bot pour qu'il envoie les détails de chaque projet **visité** à l'API d'Ollama.
  - [x] Utiliser le **Prompt d'Analyse de Projet** pour demander à l'IA si le projet est pertinent (par exemple, en répondant OUI/NON).
  - [x] Mettre à jour le statut du projet dans `projects.json` avec le résultat de l'analyse de l'IA (ex: `status: 'analysé - pertinent'` ou `status: 'analysé - non pertinent'`).
  - [x] Afficher ce nouveau statut sur l'interface.

- [ ] **Phase 4 : Action du Bot (Réponse)**
  - [ ] Pour les projets jugés pertinents, utiliser les autres prompts pour générer un devis et un message de réponse.
  - [ ] Implémenter la logique pour poster cette réponse sur `codeur.com`.