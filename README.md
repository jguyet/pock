# Pock 🎯

Une interface de chat multi-agents moderne pour gérer des conversations entre différents agents (project-manager, lead-developer, developer, etc.) avec support des mentions @ et persistance des messages.

## Fonctionnalités

- 💬 **Chat en temps réel** - Interface de chat moderne et réactive
- 🎯 **Système d'agents** - Sélectionnez différents agents (user, project-manager, lead-developer, developer, tester)
- @ **Mentions** - Mentionnez des agents avec @ et autocomplétion
- 📁 **Gestion de projets** - Chaque projet a son propre historique de chat
- 💾 **Persistance** - Chaque projet sauvegarde ses messages dans son propre `chat.json`
- 🔄 **Exécution automatique** - Les commandes Claude s'exécutent automatiquement après l'envoi
- 🤖 **Middleware Ollama** - Extraction automatique du JSON des réponses Claude via Ollama
- 🎨 **UI Moderne** - Design élégant avec animations fluides

## Installation

1. Installez les dépendances :

```bash
npm install
```

## Utilisation

1. Démarrez le serveur :

```bash
npm start
```

Ou en mode développement avec auto-reload :

```bash
npm run dev
```

2. Ouvrez votre navigateur à l'adresse :

```
http://localhost:8080
```

## Structure du projet

```
pock/
├── src/
│   ├── server.js                      # Point d'entrée du serveur
│   ├── processor/
│   │   └── MessageProcessor.js        # Classe pour exécuter les commandes Claude
│   ├── middleware-agents/
│   │   └── OllamaMiddleware.js        # Middleware Ollama pour extraction JSON
│   ├── services/
│   │   ├── BlockService.js            # Service de gestion des blocks
│   │   └── ChatService.js             # Service de gestion des chat.json
│   └── routes/
│       ├── messages.js                # Routes API pour les messages
│       ├── processor.js               # Routes API pour le traitement
│       └── projects.js                # Routes API pour les projets
├── public/
│   ├── index.html                     # Interface HTML
│   ├── styles.css                     # Styles CSS
│   └── app.js                         # Logique JavaScript côté client
├── package.json                        # Dépendances du projet
├── chat.json                          # Historique des messages (créé automatiquement)
└── README.md                          # Ce fichier
```

## API Endpoints

### GET /api/messages
Récupère l'historique complet des messages.

**Response:**
```json
{
  "messages": [
    {
      "id": 1738800000000,
      "agent": "user",
      "content": "Hello @developer",
      "projectFolder": "/Users/jeremyguyet/ia-projects/pock",
      "timestamp": "2026-02-05T10:00:00.000Z"
    }
  ]
}
```

### POST /api/messages
Envoie un nouveau message.

**Request Body:**
```json
{
  "agent": "user",
  "content": "Hello @developer",
  "projectFolder": "/Users/jeremyguyet/ia-projects/pock",
  "timestamp": "2026-02-05T10:00:00.000Z"
}
```

### DELETE /api/messages
Efface tout l'historique des messages.

### POST /api/project-folder
Crée un dossier de projet s'il n'existe pas.

**Request Body:**
```json
{
  "folder": "/Users/jeremyguyet/ia-projects/my-project"
}
```

## Gestion des projets

### Historique de chat par projet

Chaque projet a son propre fichier `chat.json` :

```
/Users/jeremyguyet/ia-projects/mon-projet/
├── chat.json              # Historique de chat du projet
├── OBJECTIVE.md           # Objectifs du projet
├── TEAM.md               # Structure de l'équipe
├── METRICS.md            # Métriques et KPIs
├── block/                # Dossier des blocks de travail
│   ├── 1.md
│   └── 2.md
└── src/
    └── ...
```

### Initialisation automatique d'un nouveau projet

Lorsque vous définissez un nouveau projet (nouveau dossier), Pock initialise automatiquement la structure en clonant le repository [example-struct](https://github.com/jguyet/example-struct.git) qui contient :

- **OBJECTIVE.md** - Document décrivant les objectifs du projet
- **TEAM.md** - Structure de l'équipe (rôles des agents)
- **METRICS.md** - Métriques de suivi du projet
- **block/** - Dossier pour organiser les blocks de travail

**Exemple :**

1. Vous définissez un nouveau projet : `/Users/jeremyguyet/ia-projects/nouveau-projet`
2. Pock détecte que c'est un nouveau projet vide
3. Clone automatiquement `example-struct` dans le dossier
4. Crée le fichier `chat.json`
5. Le projet est prêt avec sa structure de base

Lorsque vous changez de projet via l'en-tête, l'interface charge automatiquement l'historique de chat de ce projet.

### Structure du template example-struct

Le template [example-struct](https://github.com/jguyet/example-struct.git) contient :

#### **OBJECTIVE.md**
Décrit les objectifs et la vision du projet.

#### **TEAM.md**
Définit la structure de l'équipe et les rôles des agents :
- project-manager
- lead-developer
- developer
- tester

#### **METRICS.md**
Métriques et KPIs pour suivre la progression du projet.

#### **block/**
Dossier pour organiser les blocks de travail. Chaque block est un fichier markdown (1.md, 2.md, etc.) qui documente une phase de développement.

**Note :** Vous pouvez modifier ces fichiers selon vos besoins après l'initialisation.

### Workflow complet d'un projet

1. **Créer un nouveau projet**
   - Dans l'interface, entrez le dossier : `/Users/jeremyguyet/ia-projects/mon-app`
   - Cliquez sur "Set"
   - Pock clone automatiquement `example-struct`
   - Le projet est initialisé avec OBJECTIVE.md, TEAM.md, METRICS.md, et block/

2. **Définir les objectifs**
   - Éditez `OBJECTIVE.md` pour décrire votre projet
   - Éditez `TEAM.md` pour personnaliser les rôles

3. **Commencer le développement**
   - Envoyez un message : `@project-manager Create a web app`
   - Le message s'exécute automatiquement via Claude
   - Les réponses sont sauvegardées dans `chat.json`
   - Les blocks de travail sont créés dans `block/`

4. **Suivi de progression**
   - Chaque block (1.md, 2.md, etc.) documente une phase
   - Quand un block est marqué `Status: COMPLETED`, le blockId passe au suivant
   - L'historique complet reste dans `chat.json`

## Utilisation des agents

L'interface permet de mentionner différents agents avec `@` :

- **user** - Utilisateur par défaut
- **project-manager** - Gestionnaire de projet
- **lead-developer** - Développeur principal
- **developer** - Développeur
- **tester** - Testeur

## Middleware Ollama pour extraction JSON

### Prérequis

Pock utilise **Ollama** avec le modèle `erukude/omni-json:1b` pour extraire proprement le JSON des réponses de Claude.

1. **Installez Ollama** : https://ollama.ai/
2. **Téléchargez le modèle** :
   ```bash
   ollama pull erukude/omni-json:1b
   ```
3. **Démarrez Ollama** (port 11434 par défaut)

### Fonctionnement

Quand Claude répond, sa sortie passe par le middleware Ollama qui :
1. Envoie la sortie brute à Ollama
2. Extrait uniquement le JSON propre
3. Parse les champs `for`, `blockId`, `response`
4. Utilise le champ `response` comme contenu du message

**Exemple de flux :**

```
Claude output (brut):
"Excellent! Block 3 is complete. Let me return...
{"for":"project-manager","blockId":3,"response":"Block completed successfully"}"

         ↓ [Ollama Middleware]

JSON extrait:
{"for":"project-manager","blockId":3,"response":"Block completed successfully"}

         ↓

Message final dans le chat:
"Block completed successfully"
```

### Configuration

Modifiez dans `src/routes/processor.js` si nécessaire :

```javascript
const ollamaMiddleware = new OllamaMiddleware({
  ollamaUrl: 'http://localhost:11434',  // URL Ollama
  model: 'erukude/omni-json:1b'         // Modèle à utiliser
});
```

### Fallback

Si Ollama n'est pas disponible, le système utilise la sortie brute de Claude sans traitement.

## Mentions @

Utilisez le symbole `@` suivi du nom d'un agent pour le mentionner dans vos messages :

```
@project-manager Pouvez-vous créer les specs?
@developer Implémentez la fonctionnalité X
@tester Testez le module Y
```

Les mentions apparaîtront en surbrillance dans le chat.

## Raccourcis clavier

- **Enter** - Envoyer le message
- **Shift + Enter** - Nouvelle ligne
- **Tab** - Autocomplétion des mentions (à venir)

## Technologies

- **Backend:** Node.js, Express
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Persistance:** Fichier JSON

## Licence

MIT

