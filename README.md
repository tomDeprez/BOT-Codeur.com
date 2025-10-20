# 🤖 BOT-Codeur.com

<p align="center">
  <img src="https://via.placeholder.com/400x200.png?text=BOT-Codeur.com" alt="Bot-Codeur.com Logo" width="400"/>
</p>

<p align="center">
    Un bot intelligent pour automatiser votre prospection sur Codeur.com !
</p>

---

## 🚀 Description

Ce projet est un bot conçu pour automatiser les interactions sur la plateforme `codeur.com`. Il a pour but de vous faire gagner du temps en répondant automatiquement aux appels d'offres et aux messages des clients grâce à une intelligence artificielle locale (Ollama).

Le bot est entièrement configurable et contrôlable via une interface web moderne et intuitive.

## ✨ Features

- **Interface de Configuration Web :** Une page web au design moderne pour configurer le bot.
- **Analyse des Données :**
  - Extraction des conversations depuis la messagerie.
  - Extraction des projets et de leurs détails (titre, budget, statut...).
  - Gestion d'état pour ne traiter chaque projet qu'une seule fois.
- **Contrôle Manuel :**
  - Démarrez le bot quand vous le souhaitez grâce à un bouton sur l'interface.
  - Videz le cache des projets pour forcer une nouvelle analyse complète.
- **Visualisation des Résultats :** Les données extraites sont affichées directement sur la page.
- **Configuration Modulaire :** Fichiers `auth.json` et `prompts.json` pour une gestion claire.
- **IA Personnalisable (4 Prompts) :** Définissez la personnalité, la logique d'analyse, le format des devis et le style de réponse du bot.
- **Tests Unitaires :** Une suite de tests avec Jest pour garantir la stabilité et éviter les régressions.
- **Containerisation :** Le projet est entièrement dockerisé pour un déploiement facile.

## 🛠️ Tech Stack

- **Backend :** Node.js, Express
- **Frontend :** HTML, Bootstrap, Bootstrap Icons
- **Parsing HTML :** Cheerio
- **Tests :** Jest, Supertest
- **IA :** Ollama
- **Containerisation :** Docker, Docker Compose

## 📋 Prérequis

Avant de commencer, assurez-vous d'avoir installé [Docker](https://www.docker.com/get-started) sur votre machine.

## ⚡ Installation & Démarrage Rapide

1.  **Clonez le projet.**
2.  **Lancez les services :** `docker-compose up -d --build`.
3.  **C'est prêt !** 🎉

## ⚙️ Utilisation

1.  **Accédez à l'interface :** `http://localhost:3000`.
2.  **Configurez le bot :** Remplissez le cookie, les prompts, et sauvegardez.
3.  **Lancez le Bot :** Cliquez sur **"Démarrer le Bot"** pour lancer l'analyse. Les résultats s'afficheront sur la page.

## 🧪 Tests

Pour garantir la qualité du code, des tests ont été mis en place. Pour les lancer, placez-vous dans le dossier `webapp` et exécutez la commande :

```bash
npm test
```

## 📈 Statut du Projet

- [x] **Phase 1 : Infrastructure et Configuration (Terminée)**
  - [x] Infrastructure Docker, UI V1, Config V1.
  - [x] Amélioration UI (V2) et refactorisation de la config (V3).

- [x] **Phase 2 : Analyse des Données et Tests (Terminée)**
  - [x] Ajout de `cheerio` pour le parsing HTML.
  - [x] Extraction des conversations et des URLs de projets.
  - [x] Déclenchement manuel et affichage des résultats sur l'UI.
  - [x] **Mise en place de l'environnement de test avec Jest et Supertest.**
  - [x] **Rédaction de tests pour la sauvegarde de la configuration.**

- [ ] **Phase 3 : Intégration avec Ollama**
  - [ ] Envoyer les données extraites à l'API d'Ollama.

- [ ] **Phase 4 : Action du Bot (Réponse)**
  - [ ] Implémenter l'envoi de réponses sur `codeur.com`.

---

*Développé avec ❤️ pour les freelances.*