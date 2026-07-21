const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

const MASTER_KEY = 'KING-LOVABLE-2024-SECRET';
const KEYS_FILE = path.join(__dirname, 'keys.json');
const BANNED_FILE = path.join(__dirname, 'banned.json');
const ALLOWED_ROLE = 'REVENDEDOR';
const STAFF_ROLE = '🛡️staff';
const MEMBER_ROLE = '💙​membros';
const WELCOME_CHANNEL_ID = '1528137128649687120';
const LOGS_CHANNEL_ID = '1528140183361294398';
const TICKET_CHANNEL_ID = '1528138255122567208';
const TICKET_CATEGORY_ID = '1528138159559540887';

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
  } catch(e) {}
}

function isStaff(member) { return member.roles.cache.some(r => r.name === STAFF_ROLE); }
function isRevendedor(member) { return member.roles.cache.some(r => r.name === ALLOWED_ROLE); }
function hasPermission(member) { return isStaff(member) || isRevendedor(member); }

client.on('ready', async () => {
  console.log('🤖 Bot King Lovable online!');
  
  const ticketChannel = client.channels.cache.get(TICKET_CHANNEL_ID);
  if (ticketChannel) {
    const embed = new EmbedBuilder()
      .setTitle('⚡┃King Atendimento')
      .setDescription('📦 **Abra este ticket para:**\n• Resgatar seu produto\n• Enviar comprovante de pagamento\n• Tirar dúvidas\n• Resolver problemas\n• Solicitar suporte\n\n🔒 **Nosso atendimento é seguro e privado.**\n⚡ **Respondemos o mais rápido possível.**\n\n🙏 Pedimos que tenha paciência e envie todas as informações necessárias para agilizar seu atendimento.\n\n💸 **King Lovable – rapidez, confiança e qualidade.**')
      .setColor('#ffd700');
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_ticket').setLabel('📩 Abrir Ticket').setStyle(ButtonStyle.Danger));
    await ticketChannel.send({ embeds: [embed], components: [row] });
  }
  
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
      { name: 'relatorio', description: '📋 Relatório', options: [{ name: 'revendedor', description: 'Nome', type: 3, required: false }] },
      { name: 'deletarkey', description: '🗑️ Apagar key (Staff)', options: [{ name: 'key', description: 'Key', type: 3, required: true }] },
      { name: 'ban', description: '🚫 Banir (Staff)', options: [{ name: 'usuario', description: 'Nome', type: 3, required: true }] },
      { name: 'unban', description: '✅ Desbanir (Staff)', options: [{ name: 'usuario', description: 'Nome', type: 3, required: true }] },
      { name: 'keyscliente', description: '🔍 Buscar por cliente (Staff)', options: [{ name: 'cliente', description: 'Nome', type: 3, required: true }] },
      { name: 'expirarkey', description: '⏰ Expirar key (Staff)', options: [{ name: 'key', description: 'Key', type: 3, required: true }] },
      { name: 'statuskey', description: '🔍 Status da key (Staff)', options: [{ name: 'key', description: 'Key', type: 3, required: true }] },
      { name: 'limparlogs', description: '🧹 Limpar keys expiradas (Staff)' },
      { name: 'fecharticket', description: '🔒 Fechar ticket (Staff)' }
    ]);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton() && interaction.customId === 'open_ticket') {
    const user = interaction.user;
    const guild = interaction.guild;
    const existing = guild.channels.cache.find(c => c.name === `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`);
    if (existing) return interaction.reply({ content: '❌ Você já tem um ticket aberto! <#' + existing.id + '>', ephemeral: true });
    
    try {
      const ticketChannel = await guild.channels.create({
        name: `ticket-${user.username}`, type: ChannelType.GuildText, parent: TICKET_CATEGORY_ID,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
        ]
      });
      const staffRole = guild.roles.cache.find(r => r.name === STAFF_ROLE);
      if (staffRole) await ticketChannel.permissionOverwrites.create(staffRole, { ViewChannel: true, SendMessages: true });
      const embed = new EmbedBuilder().setTitle('🎫 Ticket').setDescription(`Olá ${user}, descreva seu problema!`).setColor('#ffd700');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Fechar').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('resolve_ticket').setLabel('✅ Resolvido').setStyle(ButtonStyle.Success)
      );
      await ticketChannel.send({ content: `${user}`, embeds: [embed], components: [row] });
      await interaction.reply({ content: '✅ Ticket criado! <#' + ticketChannel.id + '>', ephemeral: true });
    } catch(e) { await interaction.reply({ content: '❌ Erro ao criar ticket. Dê permissão de Gerenciar Canais ao bot!', ephemeral: true }); }
  }
  
  if (interaction.isButton() && interaction.customId === 'close_ticket') {
    if (!isStaff(interaction.member)) return interaction.reply({ content: '❌ Apenas Staff!', ephemeral: true });
    await interaction.reply({ content: '🔒 Fechando...' });
    setTimeout(async () => { await interaction.channel.delete().catch(() => {}); }, 5000);
  }
  
  if (interaction.isButton() && interaction.customId === 'resolve_ticket') {
    if (!isStaff(interaction.member)) return interaction.reply({ content: '❌ Apenas Staff!', ephemeral: true });
    await interaction.channel.setName(`✅-${interaction.channel.name}`).catch(() => {});
    await interaction.reply({ content: '✅ Ticket resolvido! Canal será excluído em 10s.' });
    setTimeout(async () => { await interaction.channel.delete().catch(() => {}); }, 10000);
  }
  
  if (!interaction.isCommand()) return;
  
  const member = interaction.member;
  const banned = loadBanned();
  const userTag = interaction.user.tag;
  
  if (banned.includes(userTag) && !isStaff(member)) return interaction.reply({ content: '🚫 Banido!', ephemeral: true });
  
  const staffCommands = ['relatorio', 'deletarkey', 'ban', 'unban', 'keyscliente', 'expirarkey', 'statuskey', 'limparlogs', 'fecharticket'];
  if (staffCommands.includes(interaction.commandName) && !isStaff(member)) return interaction.reply({ content: '❌ Apenas Staff!', ephemeral: true });
  
  if (['gerarkey', 'keys'].includes(interaction.commandName) && !hasPermission(member)) return interaction.reply({ content: '❌ Sem permissão!', ephemeral: true });
  
  const cmd = interaction.commandName;
  
  if (cmd === 'gerarkey') {
    const duration = interaction.options.getString('duracao');
    const quantity = interaction.options.getInteger('quantidade') || 1;
    const clientName = interaction.options.getString('cliente') || 'N/A';
    if (quantity < 1 || quantity > 10) return interaction.reply({ content: '❌ Quantidade deve ser entre 1 e 10', ephemeral: true });
    
    const keys = [];
    for (let i = 0; i < quantity; i++) keys.push({ key: generateKey(duration), plan: 'premium', client: clientName, revendedor: userTag, duration: DURATION_LABELS[duration], created: new Date().toISOString(), status: 'active' });
    const allKeys = loadKeys(); allKeys.unshift(...keys); saveKeys(allKeys);
    sendLog(client, userTag, '🔑 Keys Geradas', `**Qtd:** ${quantity}\n**Duração:** ${DURATION_LABELS[duration]}\n**Cliente:** ${clientName}\n**Keys:**\n${keys.map(k => '`' + k.key + '`').join('\n')}`);
    
    // Resposta privada com as keys (só quem gerou vê)
    const embed = new EmbedBuilder().setTitle('🔑 Key(s) Gerada(s)').setColor('#ff3333')
      .setDescription(keys.map(k => '`' + k.key + '`').join('\n'))
      .addFields({ name: '📅 Duração', value: DURATION_LABELS[duration], inline: true }, { name: '👤 Cliente', value: clientName, inline: true }, { name: '📦 Qtd', value: String(quantity), inline: true })
      .setFooter({ text: 'King Lovable | ' + new Date().toLocaleString('pt-BR') });
    await interaction.reply({ embeds: [embed], ephemeral: true });
    
    // Mensagem pública no canal (fixa, não some)
    const embedPublico = new EmbedBuilder()
      .setTitle('🔑 Key(s) Gerada(s)')
      .setColor('#ff3333')
      .setDescription('📦 **' + quantity + ' key(s) gerada(s)!**')
      .addFields(
        { name: '📅 Duração', value: DURATION_LABELS[duration], inline: true },
        { name: '👤 Cliente', value: clientName, inline: true },
        { name: '🛡️ Revendedor', value: userTag, inline: true }
      )
      .setFooter({ text: 'King Lovable | ' + new Date().toLocaleString('pt-BR') });
    await interaction.channel.send({ embeds: [embedPublico] });
  }
  
  if (cmd === 'keys') { const allKeys = loadKeys(); await interaction.reply({ embeds: [new EmbedBuilder().setTitle('📊 Stats').setColor('#ffd700').addFields({ name: '📦 Total', value: String(allKeys.length), inline: true }, { name: '🟢 Ativas', value: String(allKeys.filter(k => k.status === 'active').length), inline: true }, { name: '🔴 Exp', value: String(allKeys.filter(k => k.status === 'expired').length), inline: true })], ephemeral: true }); }
  if (cmd === 'relatorio') { const rev = interaction.options.getString('revendedor'); let allKeys = loadKeys(); if (rev) allKeys = allKeys.filter(k => k.revendedor && k.revendedor.toLowerCase().includes(rev.toLowerCase())); const porRev = {}; allKeys.forEach(k => { const r = k.revendedor || 'N/A'; if (!porRev[r]) porRev[r] = { t: 0, a: 0 }; porRev[r].t++; if (k.status === 'active') porRev[r].a++; }); const embed = new EmbedBuilder().setTitle('📋 Relatório').setColor('#ffd700'); let d = ''; for (const [r, s] of Object.entries(porRev)) d += `**${r}**\n📦 ${s.t} | 🟢 ${s.a}\n\n`; embed.setDescription(d || 'Nenhuma key'); await interaction.reply({ embeds: [embed], ephemeral: true }); }
  if (cmd === 'deletarkey') { const key = interaction.options.getString('key').trim().toUpperCase(); let k = loadKeys(); k = k.filter(x => x.key !== key); saveKeys(k); sendLog(client, userTag, '🗑️ Key', `\`${key}\``); await interaction.reply({ content: '✅ Apagada!', ephemeral: true }); }
  if (cmd === 'ban') { const u = interaction.options.getString('usuario'); let b = loadBanned(); if (b.includes(u)) return interaction.reply({ content: '❌ Já banido!', ephemeral: true }); b.push(u); saveBanned(b); await interaction.reply({ content: '🚫 ' + u + ' banido!', ephemeral: true }); }
  if (cmd === 'unban') { const u = interaction.options.getString('usuario'); let b = loadBanned(); b = b.filter(x => x !== u); saveBanned(b); await interaction.reply({ content: '✅ ' + u + ' desbanido!', ephemeral: true }); }
  if (cmd === 'keyscliente') { const c = interaction.options.getString('cliente').toLowerCase(); const keys = loadKeys().filter(k => k.client && k.client.toLowerCase().includes(c)); if (keys.length === 0) return interaction.reply({ content: '❌ Nenhuma!', ephemeral: true }); await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔍 ' + c).setColor('#ffd700').setDescription(keys.slice(0,20).map(k => `\`${k.key}\` - ${k.duration}`).join('\n'))], ephemeral: true }); }
  if (cmd === 'expirarkey') { const key = interaction.options.getString('key').trim().toUpperCase(); let k = loadKeys(); const f = k.find(x => x.key === key); if (!f) return interaction.reply({ content: '❌ Não encontrada!', ephemeral: true }); f.status = 'expired'; saveKeys(k); await interaction.reply({ content: '✅ Expirada!', ephemeral: true }); }
  if (cmd === 'statuskey') { const key = interaction.options.getString('key').trim().toUpperCase(); const f = loadKeys().find(k => k.key === key); if (!f) return interaction.reply({ content: '❌ Não encontrada!', ephemeral: true }); await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔍 Status').setColor(f.status==='active'?'#51cf66':'#ff3333').addFields({ name:'🔑', value:'`'+f.key+'`' },{ name:'📊', value:f.status==='active'?'🟢 Ativa':'🔴 Expirada' },{ name:'👤', value:f.client||'N/A' },{ name:'🛡️', value:f.revendedor||'N/A' })], ephemeral: true }); }
  if (cmd === 'limparlogs') { let k = loadKeys(); const exp = k.filter(x => x.status==='expired'); k = k.filter(x => x.status!=='expired'); saveKeys(k); await interaction.reply({ content: `✅ ${exp.length} removidas!`, ephemeral: true }); }
  if (cmd === 'fecharticket') { if (!interaction.channel.name.startsWith('ticket-')) return interaction.reply({ content: '❌ Não é ticket!', ephemeral: true }); await interaction.reply({ content: '🔒 Fechando...' }); setTimeout(async () => { await interaction.channel.delete().catch(() => {}); }, 5000); }
});

client.on('guildMemberAdd', async (member) => {
  try {
    const role = member.guild.roles.cache.find(r => r.name === MEMBER_ROLE);
    if (role) await member.roles.add(role);
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (channel) channel.send({ embeds: [new EmbedBuilder().setTitle('👋 Bem-vindo(a)!').setDescription(`Bem-vindo, ${member}! 🎉`).setColor('#ffd700')] });
  } catch(e) {}
});

client.login(process.env.DISCORD_TOKEN);
