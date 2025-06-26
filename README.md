# RoomBot

Bot Discord pour surveiller l'occupation des salles EpiRooms en temps réel.

## 🚀 Installation

1. **Cloner le projet**
   ```bash
   git clone <url-du-repo>
   cd RoomBot
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Configuration**

   Copier le fichier d'exemple et le configurer :
   ```bash
   cp .env.example .env
   ```

   Éditer le fichier `.env` avec vos informations :
   ```env
   DISCORD_TOKEN=votre_token_discord
   CLIENT_ID=votre_client_id
   GUILD_ID=votre_guild_id_optionnel
   EPIROOMS_URL=https://epirooms.eu/LIL/2
   UPDATE_INTERVAL=0 * * * *
   ```

4. **Créer une application Discord**

   - Aller sur https://discord.com/developers/applications
   - Créer une nouvelle application
   - Aller dans l'onglet "Bot" et créer un bot
   - Copier le token dans `DISCORD_TOKEN`
   - Copier l'Application ID dans `CLIENT_ID`
   - Inviter le bot sur votre serveur avec les permissions nécessaires

## 🎯 Utilisation

**Démarrer le bot :**
```bash
npm start
```

**Mode développement (avec rechargement automatique) :**
```bash
npm run dev
```

## 📋 Commandes disponibles

- `/salles-libres` - Affiche toutes les salles libres
- `/salles-occupees` - Affiche toutes les salles occupées
- `/salle <nom>` - Affiche le statut d'une salle spécifique
- `/etage <numero>` - Affiche toutes les salles d'un étage (0=RDC, 1=1er, 2=2ème, 3=3ème)
- `/resume` - Résumé de l'occupation des salles
- `/refresh` - Force la mise à jour des données

## ⚙️ Configuration

### Variables d'environnement

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DISCORD_TOKEN` | Token du bot Discord | `MTIzNDU2Nzg5MA...` |
| `CLIENT_ID` | ID de l'application Discord | `1234567890123456789` |
| `GUILD_ID` | ID du serveur Discord (optionnel) | `9876543210987654321` |
| `EPIROOMS_URL` | URL du site EpiRooms | `https://epirooms.eu/LIL/2` |
| `UPDATE_INTERVAL` | Intervalle de mise à jour (format cron) | `0 * * * *` |

### Intervalle de mise à jour

Le format cron pour `UPDATE_INTERVAL` :
- `0 * * * *` - Toutes les heures à la minute 0
- `*/30 * * * *` - Toutes les 30 minutes
- `0 9-18 * * 1-5` - Toutes les heures de 9h à 18h, du lundi au vendredi

## 🔧 Fonctionnalités

- ✅ Surveillance en temps réel des salles EpiRooms
- ✅ Commandes slash Discord intuitives
- ✅ Mise à jour automatique configurable
- ✅ Affichage par statut (libre/occupé/réservé)
- ✅ Filtrage par étage
- ✅ Recherche de salle spécifique
- ✅ Résumé statistique de l'occupation

## 📊 Statuts des salles

- 🟢 **Libre** - Salle disponible
- 🔴 **Occupée** - Salle en cours d'utilisation
- 🟡 **Réservée** - Salle réservée mais pas encore occupée
- ❓ **Inconnue** - Statut non déterminé

## 🛠️ Développement

Le bot utilise :
- **Discord.js v14** pour l'API Discord
- **Axios** pour les requêtes HTTP
- **Cheerio** pour le parsing HTML
- **node-cron** pour les tâches planifiées
- **dotenv** pour la gestion des variables d'environnement

## 📝 Licence

MIT