# Job CV Scraper

Webscraper temps reel qui analyse un CV et remonte les offres d'emploi qui lui
correspondent le mieux, en continu.

## Fonctionnement

1. Le CV (`.pdf` ou `.txt`) est lu et des mots-cles/competences sont extraits
   (dictionnaire de competences techniques + mots les plus frequents du texte).
2. Le scraper interroge plusieurs sources d'offres d'emploi publiques :
   - [Arbeitnow](https://arbeitnow.com/) (API JSON publique, offres tous secteurs)
   - [WeWorkRemotely](https://weworkremotely.com/) (flux RSS, offres remote/dev)
3. Chaque offre est scoree selon le nombre de mots-cles du CV qu'elle contient
   (titre, description, tags), puis les meilleures offres sont affichees.
4. En mode continu (par defaut), le scraper reinterroge les sources a
   intervalle regulier et ne notifie que les **nouvelles** offres (deja vues =
   ignorees), grace a un fichier `.seen.json` local.

## Installation

```bash
npm install
```

## Utilisation

Une seule verification :

```bash
node index.js --cv ./cv.pdf --once
```

Mode temps reel (verifie toutes les 15 minutes par defaut) :

```bash
node index.js --cv ./cv.pdf --interval 15 --top 10
```

### Options

| Option        | Description                                      | Defaut |
| ------------- | ------------------------------------------------- | ------ |
| `--cv`        | Chemin vers le CV (`.pdf` ou `.txt`)               | requis |
| `--interval`  | Minutes entre deux verifications (mode continu)    | 15     |
| `--top`       | Nombre max d'offres affichees par verification     | 10     |
| `--min-score` | Score minimum pour qu'une offre soit retenue        | 1      |
| `--once`      | Ne fait qu'une seule verification puis s'arrete    | false  |

## Structure

```
index.js                       CLI: orchestration + boucle temps reel
bot.js                          Bot Telegram
src/cvParser.js                 Extraction de texte + mots-cles depuis le CV
src/matcher.js                  Scoring des offres par rapport aux mots-cles
src/store.js                    Persistance des offres deja vues
src/subscriptions.js             Etat des abonnements Telegram par conversation
src/sources/arbeitnow.js        Source: API Arbeitnow
src/sources/weworkremotely.js   Source: flux RSS WeWorkRemotely
```

## Bot Telegram

Le bot permet d'envoyer son CV directement dans Telegram et de recevoir les
offres correspondantes, avec suivi automatique des nouvelles offres.

### 1. Creer votre bot

Chaque personne qui deploie ce projet doit creer **son propre bot** et utiliser
**son propre token** (ne jamais partager ou committer un token) :

1. Ouvrez une conversation avec [@BotFather](https://t.me/BotFather) sur Telegram.
2. Envoyez `/newbot` et suivez les instructions.
3. Recuperez le token fourni (format `123456789:ABC...`).

### 2. Configurer

```bash
cp .env.example .env
# editez .env et collez VOTRE token dans TELEGRAM_BOT_TOKEN
npm install
```

### 3. Lancer

```bash
npm run bot
```

### Utilisation dans Telegram

1. Ouvrez une conversation avec votre bot et envoyez `/start`.
2. Envoyez votre CV en tant que **document** (`.pdf` ou `.txt`).
3. Le bot repond avec les mots-cles detectes et les meilleures offres du moment.

Commandes disponibles :

| Commande        | Description                                              |
| --------------- | --------------------------------------------------------- |
| `/start`        | Instructions                                               |
| `/status`       | Voir le CV enregistre et l'etat du suivi                   |
| `/jobs`         | Chercher des offres maintenant                             |
| `/watch [min]`  | Activer le suivi automatique (defaut 15 min, min 5 min)    |
| `/stop`         | Arreter le suivi automatique                                |

Les CV, mots-cles et offres deja vues sont stockes par conversation dans
`data/` (ignore par git, car il peut contenir des donnees personnelles).

### 4. Deployer gratuitement (pour tourner 24/7 sans PC)

Le projet inclut un `Dockerfile` et un mini serveur HTTP de health-check
(`bot.js` ecoute sur `PORT`), compatible avec la plupart des hebergeurs
gratuits. Dans tous les cas, **le token n'est jamais dans le repo** : chaque
personne qui deploie doit le renseigner elle-meme dans les variables
d'environnement de son hebergeur.

**Railway** (recommande, tourne en continu meme sans trafic HTTP) :
1. Creez un projet sur [railway.app](https://railway.app), reliez ce repo GitHub.
2. Ajoutez la variable d'environnement `TELEGRAM_BOT_TOKEN` avec votre propre token.
3. Railway detecte le `Dockerfile` a la racine et deploie automatiquement.

**Fly.io** :
1. `fly launch` depuis la racine du projet (choisir "no" pour la base de donnees).
2. `fly secrets set TELEGRAM_BOT_TOKEN=votre_token`
3. `fly deploy`

**Render** (Web Service gratuit) :
1. New Web Service, reliez ce repo, "Docker" comme environnement.
2. Ajoutez la variable d'environnement `TELEGRAM_BOT_TOKEN` avec votre propre token.
3. Note : le plan gratuit de Render met le service en veille apres 15 min
   d'inactivite HTTP ; utilisez un service de ping (ex. UptimeRobot) sur
   l'URL publique si vous voulez un suivi vraiment continu.

## Ajouter une nouvelle source

Chaque source expose une fonction `fetchJobs()` qui retourne un tableau
d'objets normalises :

```js
{
  id, title, company, location, remote, tags, url, description, postedAt, source
}
```

Ajoutez un fichier dans `src/sources/`, puis enregistrez-le dans
`fetchAllJobs()` (`index.js`).
