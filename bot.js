const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const MASTER_KEY = 'KING-LOVABLE-2024-SECRET';
const KEYS_FILE = path.join(__dirname, 'keys.json');
const ALLOWED_ROLE = 'REVENDEDOR';
const LOGS_CHANNEL_ID = '1528140328727613633';

const DURATION_LABELS = {
  '1m': '1 minuto', '5m': '5 minutos', '15m': '15 minutos', '30m': '30 minutos',
  '1h': '1 hora', '6h': '6 horas', '12h': '12 horas',
  '1d': '1 dia', '3d': '3 dias', '7d': '7 dias', '15d': '15 dias',
  '30d': '30 dias', '90d': '90 dias', '180d': '180 dias', '365d': '1 ano',
  'vitalicio': 'Vitalício'
};

const DURATION_CODES = {
  '1m': 'A', '5m': 'B', '15m': 'C', '30m': 'D',
  '1h': 'E', '6h': 'F', '12h': 'G',
  '1d': 'H', '3d': 'I', '7d': 'J', '15d': 'K',
  '30d': 'L', '90d': 'M', '180d': 'N', '365d': 'O',
  'vitalicio': 'Z'
};

function loadKeys() {
  try { if (fs.existsSync(KEYS_FILE)) return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8')); }
  catch(e) { console.error(e); }
  return [];
}

function saveKeys(keys) { fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2)); }

function generateKey(duration) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  function randomBlock() { let b = ''; for (let i = 0; i < 4; i++) b += chars[Math.floor(Math.random() * chars.length)]; return b; }
  
  const b1 = randomBlock(), b2 = randomBlock();
  let b3 = randomBlock();
  const code = DURATION_CODES[duration] || 'Z';
  b3 = code + b3.substring(1);
  
  const body = b1 + b2 + b3;
  let hash = 0;
  const str = body + MASTER_KEY;
  for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
  hash = Math.abs(hash);
  const checksum = hash.toString(36).toUpperCase().padStart(8, '0').slice(0, 8);
  
  return 'KL-' + b1 + '-' + b2 + '-' + b3 + '-' + checksum;
}

function sendLog(client, revendedor, action, details) {
  try {
    const channel = client.channels.cache.get(LOGS_CHANNEL_ID);
    if (!channel) return;
    
    const embed = new EmbedBuilder()
      .setTitle('📋 ' + action)
      .setColor('#ff3333')
      .addFields(
        { name: '👤 Revendedor', value: revendedor, inline: true },
        { name: '⏰ Data', value: new Date().toLocaleString('pt-BR'), inline: true }
      )
      .setFooter({ text: 'King Lovable Logs' })
      .setTimestamp();
    
    if (details) embed.setDescription(details);
    channel.send({ embeds: [embed] });
  } catch(e) { console.error('Erro ao enviar log:', e.message); }
}

client.once('ready', () => {
  console.log('🤖 Bot King Lovable online!');
  console.log('📋 Canal de logs:', LOGS_CHANNEL_ID);
  
  client.application.commands.create({
    name: 'gerarkey',
    description: '🔑 Gerar uma nova key',
    options: [
      { name: 'duracao', description: 'Duração da key', type: 3, required: true, choices: [
        { name: '1 minuto', value: '1m' }, { name: '5 minutos', value: '5m' },
        { name: '15 minutos', value: '15m' }, { name: '30 minutos', value: '30m' },
        { name: '1 hora', value: '1h' }, { name: '6 horas', value: '6h' },
        { name: '12 horas', value: '12h' }, { name: '1 dia', value: '1d' },
        { name: '3 dias', value: '3d' }, { name: '7 dias', value: '7d' },
        { name: '15 dias', value: '15d' }, { name: '30 dias', value: '30d' },
        { name: '90 dias', value: '90d' }, { name: '180 dias', value: '180d' },
        { name: '1 ano', value: '365d' }, { name: 'Vitalício', value: 'vitalicio' }
      ]},
      { name: 'quantidade', description: 'Quantidade de keys (1-10)', type: 4, required: false },
      { name: 'cliente', description: 'Nome do cliente', type: 3, required: false }
    ]
  });
  
  client.application.commands.create({
    name: 'keys',
    description: '📊 Ver estatísticas de keys'
  });
  
  client.application.commands.create({
    name: 'relatorio',
    description: '📋 Relatório de keys por revendedor',
    options: [
      { name: 'revendedor', description: 'Nome do revendedor (deixe vazio para todos)', type: 3, required: false }
    ]
  });
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  
  const member = interaction.member;
  const hasPermission = member.roles.cache.some(role => role.name === ALLOWED_ROLE) || 
                        member.roles.cache.some(role => role.name === 'ADMIN');
  
  if (!hasPermission) {
    return interaction.reply({ content: '❌ Você não tem permissão! Cargo necessário: **' + ALLOWED_ROLE + '** ou **ADMIN**', ephemeral: true });
  }
  
  if (interaction.commandName === 'gerarkey') {
    const duration = interaction.options.getString('duracao');
    const quantity = interaction.options.getInteger('quantidade') || 1;
    const clientName = interaction.options.getString('cliente') || 'N/A';
    
    if (quantity < 1 || quantity > 10) {
      return interaction.reply({ content: '❌ Quantidade deve ser entre 1 e 10', ephemeral: true });
    }
    
    const keys = [];
    for (let i = 0; i < quantity; i++) {
      const key = generateKey(duration);
      keys.push({ key, plan: 'premium', client: clientName, revendedor: interaction.user.tag, duration: DURATION_LABELS[duration], created: new Date().toISOString(), status: 'active' });
    }
    
    const allKeys = loadKeys();
    allKeys.unshift(...keys);
    saveKeys(allKeys);
    
    const logDetails = `**Quantidade:** ${quantity}\n**Duração:** ${DURATION_LABELS[duration]}\n**Cliente:** ${clientName}\n**Keys:**\n${keys.map(k => '`' + k.key + '`').join('\n')}`;
    sendLog(client, interaction.user.tag, '🔑 Keys Geradas', logDetails);
    
    const embed = new EmbedBuilder()
      .setTitle('🔑 Key(s) Gerada(s)')
      .setColor('#ff3333')
      .setDescription(keys.map(k => `\`\`\`${k.key}\`\`\``).join('\n'))
      .addFields(
        { name: '📅 Duração', value: DURATION_LABELS[duration], inline: true },
        { name: '👤 Cliente', value: clientName, inline: true },
        { name: '📦 Quantidade', value: String(quantity), inline: true }
      )
      .setFooter({ text: 'King Lovable | ' + new Date().toLocaleString('pt-BR') });
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
  
  if (interaction.commandName === 'keys') {
    const allKeys = loadKeys();
    const active = allKeys.filter(k => k.status === 'active').length;
    const expired = allKeys.filter(k => k.status === 'expired').length;
    
    const embed = new EmbedBuilder()
      .setTitle('📊 Estatísticas de Keys')
      .setColor('#ffd700')
      .addFields(
        { name: '📦 Total', value: String(allKeys.length), inline: true },
        { name: '🟢 Ativas', value: String(active), inline: true },
        { name: '🔴 Expiradas', value: String(expired), inline: true }
      )
      .setFooter({ text: 'King Lovable Bot' });
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
  
  if (interaction.commandName === 'relatorio') {
    const revendedor = interaction.options.getString('revendedor');
    let allKeys = loadKeys();
    
    if (revendedor) {
      allKeys = allKeys.filter(k => k.revendedor && k.revendedor.toLowerCase().includes(revendedor.toLowerCase()));
    }
    
    const porRevendedor = {};
    allKeys.forEach(k => {
      const rev = k.revendedor || 'Desconhecido';
      if (!porRevendedor[rev]) porRevendedor[rev] = { total: 0, ativas: 0, expiradas: 0 };
      porRevendedor[rev].total++;
      if (k.status === 'active') porRevendedor[rev].ativas++;
      else porRevendedor[rev].expiradas++;
    });
    
    const embed = new EmbedBuilder()
      .setTitle('📋 Relatório por Revendedor')
      .setColor('#ffd700')
      .setFooter({ text: 'King Lovable Bot' });
    
    if (Object.keys(porRevendedor).length === 0) {
      embed.setDescription('Nenhuma key encontrada.');
    } else {
      let desc = '';
      for (const [rev, stats] of Object.entries(porRevendedor)) {
        desc += `**${rev}**\n📦 Total: ${stats.total} | 🟢 Ativas: ${stats.ativas} | 🔴 Expiradas: ${stats.expiradas}\n\n`;
      }
      embed.setDescription(desc);
    }
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
