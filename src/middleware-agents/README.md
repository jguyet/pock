# Middleware Agents

Ce dossier contient les middlewares pour traiter les sorties des agents IA.

## OllamaMiddleware

Middleware pour extraire le JSON propre des réponses de Claude en utilisant Ollama.

### Utilisation

```javascript
const OllamaMiddleware = require('./middleware-agents/OllamaMiddleware');

// Initialiser
const middleware = new OllamaMiddleware({
  ollamaUrl: 'http://localhost:11434',
  model: 'erukude/omni-json:1b',
  systemPrompt: 'You will receive text with json, please return the json result only without any modification.'
});

// Traiter une sortie
const result = await middleware.process(rawOutput);

if (result.success && result.parsed) {
  console.log('JSON extrait:', result.json);
  console.log('Contenu:', result.content);
  
  // Extraire les champs spécifiques
  const fields = middleware.extractFields(result);
  console.log('For:', fields.for);
  console.log('BlockId:', fields.blockId);
  console.log('Response:', fields.response);
}
```

### Méthodes

#### `process(rawOutput)`

Traite une sortie brute et extrait le JSON via Ollama.

**Paramètres:**
- `rawOutput` (string) - Sortie brute à traiter

**Retour:**
```javascript
{
  success: true,           // true si traitement réussi
  content: "...",          // Contenu extrait (JSON string)
  parsed: true,            // true si JSON parsé avec succès
  json: {...},            // Objet JSON parsé
  rawOutput: "..."        // Sortie originale
}
```

#### `extractFields(processedResult)`

Extrait les champs standard d'un résultat traité.

**Retour:**
```javascript
{
  for: "project-manager",  // Destinataire
  blockId: 3,             // ID du block
  response: "...",        // Réponse textuelle
  action: "execute",      // Action (optionnel)
  executionOrder: [...]   // Ordre d'exécution (optionnel)
}
```

#### `isAvailable()`

Vérifie si Ollama est accessible.

**Retour:** `Promise<boolean>`

### Format attendu des réponses Claude

Le middleware cherche du JSON dans les réponses Claude au format :

```json
{
  "for": "project-manager",
  "blockId": 3,
  "response": "Block 3 completed successfully. All features implemented..."
}
```

### Configuration Ollama

**Installer Ollama:**
```bash
# macOS
brew install ollama

# Linux
curl https://ollama.ai/install.sh | sh
```

**Télécharger le modèle:**
```bash
ollama pull erukude/omni-json:1b
```

**Démarrer Ollama:**
```bash
ollama serve
# Écoute sur http://localhost:11434
```

### Exemple de requête Ollama directe

```bash
curl http://localhost:11434/api/chat -d '{
  "model": "erukude/omni-json:1b",
  "messages": [
    {
      "role": "system",
      "content": "You will receive text with json, please return the json result only without any modification."
    },
    {
      "role": "user",
      "content": "Excellent! Here is the result: {\"for\":\"developer\",\"response\":\"Task completed\"}"
    }
  ],
  "stream": false
}'
```

### Gestion d'erreurs

Si Ollama n'est pas disponible ou si l'extraction échoue, le middleware retourne la sortie brute :

```javascript
{
  success: false,
  content: rawOutput,     // Sortie originale non traitée
  parsed: false,
  error: "error message",
  rawOutput: rawOutput
}
```

### Logs

Le middleware log toutes ses opérations avec le préfixe `[OllamaMiddleware]` :

```
[OllamaMiddleware] Processing output...
[OllamaMiddleware] Raw output length: 1234
[OllamaMiddleware] Ollama response received
[OllamaMiddleware] Extracted content: {...}
[OllamaMiddleware] Successfully parsed JSON
```

## Ajouter d'autres middlewares

Pour ajouter un nouveau middleware :

1. Créez une classe dans ce dossier (ex: `MyMiddleware.js`)
2. Implémentez la méthode `process(input)`
3. Importez-le dans `src/routes/processor.js`
4. Utilisez-le dans la chaîne de traitement

```javascript
const MyMiddleware = require('../middleware-agents/MyMiddleware');
const myMiddleware = new MyMiddleware();

// Dans executeInBackground
const result1 = await ollamaMiddleware.process(rawOutput);
const result2 = await myMiddleware.process(result1.content);
```

