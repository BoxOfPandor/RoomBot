const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
require('dotenv').config();

// Configuration
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID; // Optionnel pour les commandes de guilde
const EPIROOMS_URL = process.env.EPIROOMS_URL || 'https://epirooms.eu/LIL/2';
const UPDATE_INTERVAL = process.env.UPDATE_INTERVAL || '0 * * * *';

// Vérification des variables d'environnement obligatoires
if (!DISCORD_TOKEN || !CLIENT_ID) {
    console.error('❌ Variables d\'environnement manquantes:');
    if (!DISCORD_TOKEN) console.error('  - DISCORD_TOKEN');
    if (!CLIENT_ID) console.error('  - CLIENT_ID');
    console.error('Veuillez configurer le fichier .env');
    process.exit(1);
}

// Base de données en mémoire pour stocker l'état des salles
let roomsData = [];
let lastUpdate = null;

// Statuts des salles
const ROOM_STATUS = {
    0: { name: 'Inconnue', color: 0x808080, emoji: '❓' },
    1: { name: 'Occupée', color: 0xFF4444, emoji: '🔴' },
    2: { name: 'Libre', color: 0x44FF44, emoji: '🟢' },
    3: { name: 'Réservée', color: 0xFFAA00, emoji: '🟡' }
};

// Client Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Fonction pour scraper les données des salles
async function scrapeRoomsData() {
    try {
        console.log('🔄 Récupération des données des salles...');

        const response = await axios.get(EPIROOMS_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(response.data);

        // Extraire les données JSON de la page
        const scriptTag = $('#__NEXT_DATA__').html();
        if (!scriptTag) {
            throw new Error('Impossible de trouver les données JSON');
        }

        const jsonData = JSON.parse(scriptTag);
        const rooms = jsonData.props.pageProps.townData.rooms;

        // Traiter les données des salles
        const processedRooms = rooms.map(room => {
            // Déterminer le statut basé sur les classes CSS dans le HTML
            let status = 2; // Par défaut libre

            // Chercher dans le HTML les classes pour déterminer le statut
            const roomElements = $(`g[id*="${room.display_name}"]`);
            roomElements.each((i, element) => {
                const useElement = $(element).find('use');
                const classAttr = useElement.attr('class');

                if (classAttr) {
                    if (classAttr.includes('occupied')) status = 1;
                    else if (classAttr.includes('reserved')) status = 3;
                    else if (classAttr.includes('free')) status = 2;
                }
            });

            // Extraire les activités depuis les cartes visibles
            let currentActivity = null;
            let timeSlot = null;

            const roomCard = $(`.MuiCard-root:contains("${room.display_name}")`);
            if (roomCard.length > 0) {
                const timeText = roomCard.find('p').first().text();
                const activityText = roomCard.find('p').last().text();

                if (timeText && timeText.includes('h')) {
                    timeSlot = timeText;
                    currentActivity = activityText !== timeText ? activityText : null;
                }
            }

            return {
                id: room.intra_name,
                name: room.name,
                displayName: room.display_name,
                floor: room.floor,
                seats: room.seats,
                status: status,
                currentActivity: currentActivity,
                timeSlot: timeSlot,
                lastUpdated: new Date()
            };
        });

        roomsData = processedRooms;
        lastUpdate = new Date();

        console.log(`✅ ${roomsData.length} salles mises à jour`);
        return roomsData;

    } catch (error) {
        console.error('❌ Erreur lors du scraping:', error.message);
        return null;
    }
}

// Fonction pour obtenir les salles par statut
function getRoomsByStatus(status) {
    return roomsData.filter(room => room.status === status);
}

// Fonction pour obtenir les salles par étage
function getRoomsByFloor(floor) {
    return roomsData.filter(room => room.floor === floor);
}

// Fonction pour chercher une salle par nom
function findRoom(query) {
    const searchTerm = query.toLowerCase();
    return roomsData.find(room =>
        room.displayName.toLowerCase().includes(searchTerm) ||
        room.name.toLowerCase().includes(searchTerm)
    );
}

// Commandes slash
const commands = [
    new SlashCommandBuilder()
        .setName('salles-libres')
        .setDescription('Affiche toutes les salles libres'),

    new SlashCommandBuilder()
        .setName('salles-occupees')
        .setDescription('Affiche toutes les salles occupées'),

    new SlashCommandBuilder()
        .setName('salle')
        .setDescription('Affiche le statut d\'une salle spécifique')
        .addStringOption(option =>
            option.setName('nom')
                .setDescription('Nom de la salle')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('etage')
        .setDescription('Affiche toutes les salles d\'un étage')
        .addIntegerOption(option =>
            option.setName('numero')
                .setDescription('Numéro de l\'étage (0=RDC, 1=1er, 2=2ème, 3=3ème)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(3)
        ),

    new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Résumé de l\'occupation des salles'),

    new SlashCommandBuilder()
        .setName('refresh')
        .setDescription('Force la mise à jour des données des salles')
];

// Gestionnaire d'événements Discord
client.once('ready', async () => {
    console.log(`🤖 Bot connecté : ${client.user.tag}`);

    // Première récupération des données
    await scrapeRoomsData();

    // Programmer la récupération automatique selon l'intervalle configuré
    cron.schedule(UPDATE_INTERVAL, async () => {
        console.log('⏰ Mise à jour automatique des salles...');
        await scrapeRoomsData();
    });

    console.log('✅ Bot prêt et surveillance activée !');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options } = interaction;

    try {
        switch (commandName) {
            case 'salles-libres': {
                const freeRooms = getRoomsByStatus(2);

                if (freeRooms.length === 0) {
                    await interaction.reply('❌ Aucune salle libre pour le moment.');
                    return;
                }

                const embed = new EmbedBuilder()
                    .setTitle('🟢 Salles Libres')
                    .setColor(ROOM_STATUS[2].color)
                    .setDescription(`**${freeRooms.length}** salles disponibles`)
                    .setFooter({ text: `Dernière mise à jour: ${lastUpdate?.toLocaleString('fr-FR')}` });

                // Grouper par étage
                const roomsByFloor = {};
                freeRooms.forEach(room => {
                    if (!roomsByFloor[room.floor]) roomsByFloor[room.floor] = [];
                    roomsByFloor[room.floor].push(room);
                });

                Object.keys(roomsByFloor).forEach(floor => {
                    const floorName = floor === '0' ? 'RDC' :
                                     floor === '1' ? '1er étage' :
                                     floor === '2' ? '2ème étage' : '3ème étage';

                    const roomsList = roomsByFloor[floor]
                        .map(room => `• **${room.displayName}** (${room.seats} places)`)
                        .join('\n');

                    embed.addFields({ name: floorName, value: roomsList, inline: true });
                });

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'salles-occupees': {
                const occupiedRooms = getRoomsByStatus(1);

                if (occupiedRooms.length === 0) {
                    await interaction.reply('✅ Aucune salle occupée pour le moment.');
                    return;
                }

                const embed = new EmbedBuilder()
                    .setTitle('🔴 Salles Occupées')
                    .setColor(ROOM_STATUS[1].color)
                    .setDescription(`**${occupiedRooms.length}** salles occupées`)
                    .setFooter({ text: `Dernière mise à jour: ${lastUpdate?.toLocaleString('fr-FR')}` });

                occupiedRooms.forEach(room => {
                    let fieldValue = `📍 ${room.seats} places`;
                    if (room.timeSlot) fieldValue += `\n⏰ ${room.timeSlot}`;
                    if (room.currentActivity) fieldValue += `\n📚 ${room.currentActivity}`;

                    embed.addFields({
                        name: room.displayName,
                        value: fieldValue,
                        inline: true
                    });
                });

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'salle': {
                const roomName = options.getString('nom');
                const room = findRoom(roomName);

                if (!room) {
                    await interaction.reply(`❌ Salle "${roomName}" non trouvée.`);
                    return;
                }

                const status = ROOM_STATUS[room.status];
                const embed = new EmbedBuilder()
                    .setTitle(`${status.emoji} ${room.displayName}`)
                    .setColor(status.color)
                    .addFields(
                        { name: 'Statut', value: status.name, inline: true },
                        { name: 'Étage', value: room.floor === 0 ? 'RDC' : `${room.floor}${room.floor === 1 ? 'er' : 'ème'}`, inline: true },
                        { name: 'Places', value: room.seats.toString(), inline: true }
                    )
                    .setFooter({ text: `Dernière mise à jour: ${room.lastUpdated.toLocaleString('fr-FR')}` });

                if (room.timeSlot) {
                    embed.addFields({ name: 'Horaire', value: room.timeSlot, inline: true });
                }

                if (room.currentActivity) {
                    embed.addFields({ name: 'Activité', value: room.currentActivity, inline: false });
                }

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'etage': {
                const floorNumber = options.getInteger('numero');
                const floorRooms = getRoomsByFloor(floorNumber);

                if (floorRooms.length === 0) {
                    await interaction.reply(`❌ Aucune salle trouvée à l'étage ${floorNumber}.`);
                    return;
                }

                const floorName = floorNumber === 0 ? 'RDC' :
                                 floorNumber === 1 ? '1er étage' :
                                 floorNumber === 2 ? '2ème étage' : '3ème étage';

                const embed = new EmbedBuilder()
                    .setTitle(`📍 Salles - ${floorName}`)
                    .setColor(0x0099ff)
                    .setDescription(`**${floorRooms.length}** salles sur cet étage`)
                    .setFooter({ text: `Dernière mise à jour: ${lastUpdate?.toLocaleString('fr-FR')}` });

                floorRooms.forEach(room => {
                    const status = ROOM_STATUS[room.status];
                    let fieldValue = `${status.emoji} ${status.name} - ${room.seats} places`;
                    if (room.currentActivity) fieldValue += `\n📚 ${room.currentActivity}`;

                    embed.addFields({
                        name: room.displayName,
                        value: fieldValue,
                        inline: true
                    });
                });

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'resume': {
                const libre = getRoomsByStatus(2).length;
                const occupee = getRoomsByStatus(1).length;
                const reservee = getRoomsByStatus(3).length;
                const total = roomsData.length;

                const embed = new EmbedBuilder()
                    .setTitle('📊 Résumé de l\'occupation')
                    .setColor(0x0099ff)
                    .addFields(
                        { name: '🟢 Salles Libres', value: libre.toString(), inline: true },
                        { name: '🔴 Salles Occupées', value: occupee.toString(), inline: true },
                        { name: '🟡 Salles Réservées', value: reservee.toString(), inline: true },
                        { name: '📍 Total', value: total.toString(), inline: true },
                        { name: '📈 Taux d\'occupation', value: `${Math.round((occupee / total) * 100)}%`, inline: true }
                    )
                    .setFooter({ text: `Dernière mise à jour: ${lastUpdate?.toLocaleString('fr-FR')}` });

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'refresh': {
                await interaction.deferReply();

                const result = await scrapeRoomsData();

                if (result) {
                    await interaction.editReply('✅ Données des salles mises à jour avec succès !');
                } else {
                    await interaction.editReply('❌ Erreur lors de la mise à jour des données.');
                }
                break;
            }
        }
    } catch (error) {
        console.error('Erreur lors de l\'exécution de la commande:', error);

        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply('❌ Une erreur est survenue lors de l\'exécution de la commande.');
        } else {
            await interaction.editReply('❌ Une erreur est survenue lors de l\'exécution de la commande.');
        }
    }
});

// Fonction pour enregistrer les commandes
async function deployCommands() {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

    try {
        console.log('🔄 Déploiement des commandes slash...');

        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands.map(cmd => cmd.toJSON()) }
        );

        console.log('✅ Commandes slash déployées avec succès !');
    } catch (error) {
        console.error('❌ Erreur lors du déploiement des commandes:', error);
    }
}

// Démarrage du bot
async function startBot() {
    try {
        await deployCommands();
        await client.login(DISCORD_TOKEN);
    } catch (error) {
        console.error('❌ Erreur lors du démarrage du bot:', error);
    }
}

// Gestion des erreurs
process.on('unhandledRejection', error => {
    console.error('❌ Erreur non gérée:', error);
});

// Export pour pouvoir être utilisé comme module
module.exports = { startBot, scrapeRoomsData };

// Démarrer le bot si ce fichier est exécuté directement
if (require.main === module) {
    startBot();
}