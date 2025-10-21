# Gemini - Journal des Modifications

Ce document suit les modifications et les fonctionnalités ajoutées au projet BOT-Codeur.com.

## Session de Développement

### Fonctionnalités Implémentées

1.  **Planificateur d'Exécution Automatique Intelligent:**
    *   Ajout d'une section sur l'interface utilisateur pour configurer et activer une exécution automatique du bot à un intervalle défini en minutes.
    *   Le planificateur attend la fin de chaque cycle avant de programmer le suivant pour éviter les exécutions superposées. Le temps d'attente est ajusté dynamiquement : si un cycle est plus long que l'intervalle, le suivant démarre immédiatement ; s'il est plus court, le planificateur attend le temps restant.

2.  **Journalisation (Logging) en Fichier et Affichage en Direct :**
    *   Toutes les sorties de la console du bot sont désormais automatiquement enregistrées dans un fichier `bot.log`.
    *   Une nouvelle section sur l'interface web affiche en temps réel les 30 dernières lignes de ce fichier, avec une actualisation toutes les 3 secondes pour un suivi en direct.

3.  **Gestion des Propositions Longues (>1000 caractères) :**
    *   La logique d'envoi de proposition a été améliorée pour gérer les messages longs.
    *   Si un message dépasse 1000 caractères, le bot envoie la première partie dans l'offre initiale, puis envoie automatiquement le reste du message en tant que commentaire sur cette même offre.

4.  **Sauvegarde d'État par Étape :**
    *   Pour améliorer la résilience, l'état des projets (`projects.json`) est maintenant sauvegardé après chaque phase majeure du processus (scraping, analyse, génération de proposition, et envoi).
    *   Ceci permet de relancer le bot et de reprendre le travail à partir de la dernière étape réussie en cas d'erreur ou d'interruption.

### Corrections de Bugs

*   **Correction du Minuteur de Cycle :** Le calcul de la durée d'exécution du bot pour le planificateur était incorrect. Le problème a été résolu en s'assurant que le minuteur attend la résolution complète de la promesse de la fonction `runBotLogic`, garantissant une mesure de temps précise.
