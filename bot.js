const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

const MASTER_KEY = 'KING-LOVABLE-2024-SECRET';
const KEYS_FILE = path.join(__dirname, 'keys.json');
const BANNED_FILE = path.join(__dirname, 'banned.json');
const ALLOWED_ROLE = 'REVENDEDOR';
const STAFF_ROLE = '🛡️Staff';
const MEMBER_ROLE = '💙​membros';
const WELCOME_CHANNEL_ID = '1528137128649687120';
const LOGS_CHANNEL_ID = '1528140183361294398';
const TICKET_CHANNEL_ID = '1528138255122567208';
const TICKET_CATEGORY_ID = '1528138255122567208'; // ID da categoria onde os tickets serão criados

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

function loadKeys() { try { if (fs.existsSync(KEYS_FILE)) return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8')); } catch(e) {} return []; }
function saveKeys(keys) { fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2)); }
function loadBanned() { try { if (fs.existsSync(BANNED_FILE)) return JSON.parse(fs.readFileSync(BANNED_FILE, 'utf8')); } catch(e) {} return []; }
function saveBanned(list) { fs.writeFileSync(BANNED_FILE, JSON.stringify(list, null, 2)); }

function generateKey(duration) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  function randomBlock() { let b = ''; for (let i = 0; i < 4; i++) b += chars[Math.floor(Math.random() * chars.length)]; return b; }
  const b1 = randomBlock(), b2 = randomBlock();
  let b3 = randomBlock();
  const code = DURATION_CODES[duration] || 'Z';
  b3 = code + b3.substring(1);
  const body = b1 + b2 + b3;
  let hash = 0; const str = body + MASTER_KEY;
  for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
  hash = Math.abs(hash);
  return 'KL-' + b1 + '-' + b2 + '-' + b3 + '-' + hash.toString(36).toUpperCase().padStart(8, '0').slice(0, 8);
}

function sendLog(client, revendedor, action, details) {
  try {
    const channel = client.channels.cache.get(LOGS_CHANNEL_ID);
    if (!channel) return;
    const embed = new EmbedBuilder().setTitle('📋 ' + action).setColor('#ff3333')
      .addFields({ name: '👤 Responsável', value: revendedor, inline: true }, { name: '⏰ Data', value: new Date().toLocaleString('pt-BR'), inline: true })
      .setFooter({ text: 'King Lovable Logs' }).setTimestamp();
    if (details) embed.setDescription(details);
    channel.send({ embeds: [embed] });
  } catch(e) { console.error('Erro ao enviar log:', e.message); }
}

function isStaff(member) { return member.roles.cache.some(r => r.name === STAFF_ROLE); }
function isRevendedor(member) { return member.roles.cache.some(r => r.name === ALLOWED_ROLE); }
function hasPermission(member) { return isStaff(member) || isRevendedor(member); }

// ============================================
// SISTEMA DE TICKETS
// ============================================
client.on('ready', async () => {
  console.log('🤖 Bot King Lovable online!');
  
  // Criar painel de tickets
  const ticketChannel = client.channels.cache.get(TICKET_CHANNEL_ID);
  if (ticketChannel) {
    // Limpar canal e enviar painel
    const messages = await ticketChannel.messages.fetch({ limit: 10 });
    await ticketChannel.bulkDelete(messages).catch(() => {});
    
    const embed = new EmbedBuilder()
      .setTitle('⚡┃King Atendimento')
      .setDescription(
        '📦 **Abra este ticket para:**\n' +
        '• Resgatar seu produto\n' +
        '• Enviar comprovante de pagamento\n' +
        '• Tirar dúvidas\n' +
        '• Resolver problemas\n' +
        '• Solicitar suporte\n\n' +
        '🔒 **Nosso atendimento é seguro e privado.**\n' +
        '⚡ **Respondemos o mais rápido possível.**\n\n' +
        '🙏 Pedimos que tenha paciência e envie todas as informações necessárias para agilizar seu atendimento.\n\n' +
        '💸 **King Lovable – rapidez, confiança e qualidade.**'
      )
      .setColor('#ffd700')
      .setFooter({ text: 'King Lovable Tickets' });
    
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('open_ticket')
          .setLabel('📩 Abrir Ticket')
          .setStyle(ButtonStyle.Danger)
      );
    
    await ticketChannel.send({ embeds: [embed], components: [row] });
  }
  
  // Registrar comandos
  const guild = client.guilds.cache.get('1528118685720383790');
  if (guild) {
    await guild.commands.set([
      { name: 'gerarkey', description: '🔑 Gerar uma nova key', options: [
        { name: 'duracao', description: 'Duração da key', type: 3, required: true, choices: [
          { name: '1 minuto', value: '1m' },{ name: '5 minutos', value: '5m' },{ name: '15 minutos', value: '15m' },{ name: '30 minutos', value: '30m' },
          { name: '1 hora', value: '1h' },{ name: '6 horas', value: '6h' },{ name: '12 horas', value: '12h' },
          { name: '1 dia', value: '1d' },{ name: '3 dias', value: '3d' },{ name: '7 dias', value: '7d' },{ name: '15 dias', value: '15d' },
          { name: '30 dias', value: '30d' },{ name: '90 dias', value: '90d' },{ name: '180 dias', value: '180d' },{ name: '1 ano', value: '365d' },
          { name: 'Vitalício', value: 'vitalicio' }
        ]},
        { name: 'quantidade', description: 'Quantidade de keys (1-10)', type: 4, required: false },
        { name: 'cliente', description: 'Nome do cliente', type: 3, required: false }
      ]},
      { name: 'keys', description: '📊 Ver estatísticas de keys' },
      { name: 'relatorio', description: '📋 Relatório de keys por revendedor', options: [
        { name: 'revendedor', description: 'Nome do revendedor', type: 3, required: false }
      ]},
      { name: 'deletarkey', description: '🗑️ Apagar uma key (Staff)', options: [
        { name: 'key', description: 'Key a ser apagada', type: 3, required: true }
      ]},
      { name: 'ban', description: '🚫 Banir revendedor (Staff)', options: [
        { name: 'usuario', description: 'Nome do revendedor', type: 3, required: true }
      ]},
      { name: 'unban', description: '✅ Desbanir revendedor (Staff)', options: [
        { name: 'usuario', description: 'Nome do revendedor', type: 3, required: true }
      ]},
      { name: 'keyscliente', description: '🔍 Buscar keys por cliente (Staff)', options: [
        { name: 'cliente', description: 'Nome do cliente', type: 3, required: true }
      ]},
      { name: 'expirarkey', description: '⏰ Forçar expiração de key (Staff)', options: [
        { name: 'key', description: 'Key a ser expirada', type: 3, required: true }
      ]},
      { name: 'statuskey', description: '🔍 Ver detalhes de uma key (Staff)', options: [
        { name: 'key', description: 'Key a ser verificada', type: 3, required: true }
      ]},
      { name: 'limparlogs', description: '🧹 Limpar keys expiradas (Staff)' },
      { name: 'fecharticket', description: '🔒 Fechar ticket (Staff)' }
    ]);
    console.log('✅ Comandos registrados!');
  }
});

// Abrir ticket ao clicar no botão
client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId === 'open_ticket') {
      const user = interaction.user;
      const guild = interaction.guild;
      
      // Verificar se já tem ticket aberto
      const existingChannel = guild.channels.cache.find(c => c.name === `ticket-${user.username.toLowerCase()}`);
      if (existingChannel) {
        return interaction.reply({ content: '❌ Você já tem um ticket aberto! <#' + existingChannel.id + '>', ephemeral: true });
      }
      
      // Criar canal de ticket
      const ticketChannel = await guild.channels.create({
        name: `ticket-${user.username}`,
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY_ID,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ]
      });
      
      // Adicionar staff
      const staffRole = guild.roles.cache.find(r => r.name === STAFF_ROLE);
      if (staffRole) {
        ticketChannel.permissionOverwrites.create(staffRole, { ViewChannel: true, SendMessages: true });
      }
      
      const embed = new EmbedBuilder()
        .setTitle('🎫 Ticket de Atendimento')
        .setDescription(`Olá ${user}, bem-vindo ao seu ticket!\n\nDescreva seu problema ou dúvida que a equipe irá te atender em breve.`)
        .setColor('#ffd700')
        .setFooter({ text: 'King Lovable | ' + new Date().toLocaleString('pt-BR') });
      
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Fechar Ticket').setStyle(ButtonStyle.Secondary)
        );
      
      await ticketChannel.send({ content: `${user}`, embeds: [embed], components: [row] });
      await interaction.reply({ content: '✅ Ticket criado! <#' + ticketChannel.id + '>', ephemeral: true });
    }
    
    if (interaction.customId === 'close_ticket') {
      const channel = interaction.channel;
      if (!channel.name.startsWith('ticket-')) return;
      
      await interaction.reply({ content: '🔒 Fechando ticket em 5 segundos...' });
      setTimeout(async () => {
        await channel.delete();
      }, 5000);
    }
  }
  
  if (!interaction.isCommand()) return;
  
  const member = interaction.member;
  const banned = loadBanned();
  const userTag = interaction.user.tag;
  
  if (banned.includes(userTag) && !isStaff(member)) {
    return interaction.reply({ content: '🚫 Você está banido!', ephemeral: true });
  }
  
  const staffCommands = ['relatorio', 'deletarkey', 'ban', 'unban', 'keyscliente', 'expirarkey', 'statuskey', 'limparlogs', 'fecharticket'];
  if (staffCommands.includes(interaction.commandName) && !isStaff(member)) {
    return interaction.reply({ content: '❌ Apenas **🛡️Staff** pode usar este comando!', ephemeral: true });
  }
  
  const publicCommands = ['gerarkey', 'keys'];
  if (publicCommands.includes(interaction.commandName) && !hasPermission(member)) {
    return interaction.reply({ content: '❌ Você não tem permissão!', ephemeral: true });
  }
  
  const cmd = interaction.commandName;
  
  if (cmd === 'gerarkey') {
    const duration = interaction.options.getString('duracao');
    const quantity = interaction.options.getInteger('quantidade') || 1;
    const clientName = interaction.options.getString('cliente') || 'N/A';
    if (quantity < 1 || quantity > 10) return interaction.reply({ content: '❌ Quantidade deve ser entre 1 e 10', ephemeral: true });
    
    const keys = [];
    for (let i = 0; i < quantity; i++) {
      keys.push({ key: generateKey(duration), plan: 'premium', client: clientName, revendedor: userTag, duration: DURATION_LABELS[duration], created: new Date().toISOString(), status: 'active' });
    }
    const allKeys = loadKeys(); allKeys.unshift(...keys); saveKeys(allKeys);
    sendLog(client, userTag, '🔑 Keys Geradas', `**Qtd:** ${quantity}\n**Duração:** ${DURATION_LABELS[duration]}\n**Cliente:** ${clientName}\n**Keys:**\n${keys.map(k => '`' + k.key + '`').join('\n')}`);
    
    const embed = new EmbedBuilder().setTitle('🔑 Key(s) Gerada(s)').setColor('#ff3333')
      .setDescription(keys.map(k => `\`\`\`${k.key}\`\`\``).join('\n'))
      .addFields({ name: '📅 Duração', value: DURATION_LABELS[duration], inline: true }, { name: '👤 Cliente', value: clientName, inline: true }, { name: '📦 Qtd', value: String(quantity), inline: true })
      .setFooter({ text: 'King Lovable | ' + new Date().toLocaleString('pt-BR') });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
  
  if (cmd === 'keys') {
    const allKeys = loadKeys();
    const embed = new EmbedBuilder().setTitle('📊 Estatísticas').setColor('#ffd700')
      .addFields(
        { name: '📦 Total', value: String(allKeys.length), inline: true },
        { name: '🟢 Ativas', value: String(allKeys.filter(k => k.status === 'active').length), inline: true },
        { name: '🔴 Expiradas', value: String(allKeys.filter(k => k.status === 'expired').length), inline: true }
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
  
  if (cmd === 'relatorio') {
    const rev = interaction.options.getString('revendedor');
    let allKeys = loadKeys();
    if (rev) allKeys = allKeys.filter(k => k.revendedor && k.revendedor.toLowerCase().includes(rev.toLowerCase()));
    const porRev = {};
    allKeys.forEach(k => { const r = k.revendedor || 'Desconhecido'; if (!porRev[r]) porRev[r] = { total: 0, ativas: 0 }; porRev[r].total++; if (k.status === 'active') porRev[r].ativas++; });
    const embed = new EmbedBuilder().setTitle('📋 Relatório').setColor('#ffd700');
    if (Object.keys(porRev).length === 0) embed.setDescription('Nenhuma key.');
    else { let d = ''; for (const [r, s] of Object.entries(porRev)) d += `**${r}**\n📦 ${s.total} | 🟢 ${s.ativas}\n\n`; embed.setDescription(d); }
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
  
  if (cmd === 'deletarkey') {
    const key = interaction.options.getString('key').trim().toUpperCase();
    let allKeys = loadKeys();
    const found = allKeys.find(k => k.key === key);
    if (!found) return interaction.reply({ content: '❌ Key não encontrada!', ephemeral: true });
    allKeys = allKeys.filter(k => k.key !== key);
    saveKeys(allKeys);
    sendLog(client, userTag, '🗑️ Key Apagada', `**Key:** \`${key}\``);
    await interaction.reply({ content: '✅ Key apagada!', ephemeral: true });
  }
  
  if (cmd === 'ban') {
    const usuario = interaction.options.getString('usuario');
    let banned = loadBanned();
    if (banned.includes(usuario)) return interaction.reply({ content: '❌ Já está banido!', ephemeral: true });
    banned.push(usuario);
    saveBanned(banned);
    sendLog(client, userTag, '🚫 Banido', `**Usuário:** ${usuario}`);
    await interaction.reply({ content: '🚫 ' + usuario + ' banido!', ephemeral: true });
  }
  
  if (cmd === 'unban') {
    const usuario = interaction.options.getString('usuario');
    let banned = loadBanned();
    if (!banned.includes(usuario)) return interaction.reply({ content: '❌ Não está banido!', ephemeral: true });
    banned = banned.filter(u => u !== usuario);
    saveBanned(banned);
    await interaction.reply({ content: '✅ ' + usuario + ' desbanido!', ephemeral: true });
  }
  
  if (cmd === 'keyscliente') {
    const cliente = interaction.options.getString('cliente').toLowerCase();
    let allKeys = loadKeys().filter(k => k.client && k.client.toLowerCase().includes(cliente));
    if (allKeys.length === 0) return interaction.reply({ content: '❌ Nenhuma key!', ephemeral: true });
    const embed = new EmbedBuilder().setTitle('🔍 Keys: ' + cliente).setColor('#ffd700')
      .setDescription(allKeys.slice(0, 20).map(k => `\`${k.key}\` - ${k.duration}`).join('\n'));
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
  
  if (cmd === 'expirarkey') {
    const key = interaction.options.getString('key').trim().toUpperCase();
    let allKeys = loadKeys();
    const found = allKeys.find(k => k.key === key);
    if (!found) return interaction.reply({ content: '❌ Key não encontrada!', ephemeral: true });
    found.status = 'expired';
    saveKeys(allKeys);
    await interaction.reply({ content: '✅ Key expirada!', ephemeral: true });
  }
  
  if (cmd === 'statuskey') {
    const key = interaction.options.getString('key').trim().toUpperCase();
    const found = loadKeys().find(k => k.key === key);
    if (!found) return interaction.reply({ content: '❌ Key não encontrada!', ephemeral: true });
    const embed = new EmbedBuilder().setTitle('🔍 Status').setColor(found.status === 'active' ? '#51cf66' : '#ff3333')
      .addFields(
        { name: '🔑 Key', value: '`' + found.key + '`' },
        { name: '📊 Status', value: found.status === 'active' ? '🟢 Ativa' : '🔴 Expirada' },
        { name: '👤 Cliente', value: found.client || 'N/A' },
        { name: '🛡️ Revendedor', value: found.revendedor || 'N/A' }
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
  
  if (cmd === 'limparlogs') {
    let allKeys = loadKeys();
    const expired = allKeys.filter(k => k.status === 'expired');
    allKeys = allKeys.filter(k => k.status !== 'expired');
    saveKeys(allKeys);
    await interaction.reply({ content: `✅ ${expired.length} keys removidas!`, ephemeral: true });
  }
  
  if (cmd === 'fecharticket') {
    const channel = interaction.channel;
    if (!channel.name.startsWith('ticket-')) return interaction.reply({ content: '❌ Este não é um ticket!', ephemeral: true });
    await interaction.reply({ content: '🔒 Fechando ticket em 5 segundos...' });
    setTimeout(async () => { await channel.delete(); }, 5000);
  }
});

// Boas-vindas
client.on('guildMemberAdd', async (member) => {
  try {
    const role = member.guild.roles.cache.find(r => r.name === MEMBER_ROLE);
    if (role) await member.roles.add(role);
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (channel) {
      const embed = new EmbedBuilder().setTitle('👋 Bem-vindo(a)!').setDescription(`Bem-vindo ao servidor, ${member}! 🎉`).setColor('#ffd700');
      channel.send({ embeds: [embed] });
    }
  } catch(e) {}
});

client.login(process.env.DISCORD_TOKEN);
