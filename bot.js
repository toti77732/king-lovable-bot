const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
  StringSelectMenuBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const requiredEnv = ['DISCORD_TOKEN', 'MASTER_KEY', 'GUILD_ID'];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);
if (missingEnv.length) {
  console.error(`Variáveis obrigatórias ausentes: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const CONFIG = {
  masterKey: process.env.MASTER_KEY,
  guildId: process.env.GUILD_ID,
  allowedRole: process.env.ALLOWED_ROLE || 'REVENDEDOR',
  staffRole: process.env.STAFF_ROLE || '🛡️staff',
  memberRole: process.env.MEMBER_ROLE || '💙​membros',
  welcomeChannelId: process.env.WELCOME_CHANNEL_ID || '',
  logsChannelId: process.env.LOGS_CHANNEL_ID || '',
  ticketChannelId: process.env.TICKET_CHANNEL_ID || '',
  ticketCategoryId: process.env.TICKET_CATEGORY_ID || '',
  salesCategoryId: process.env.SALES_CATEGORY_ID || '',
  customerRoleId: process.env.CUSTOMER_ROLE_ID || '',
  pixKey: process.env.PIX_KEY || '',
  pixReceiverName: process.env.PIX_RECEIVER_NAME || '',
  pixReceiverCity: process.env.PIX_RECEIVER_CITY || '',
  panelImageUrl: process.env.PANEL_IMAGE_URL || '',
  dataDir: process.env.DATA_DIR || path.join(__dirname, 'data')
};

const PLANS = {
  daily: { name: 'Diário', emoji: '🟢', duration: '1d', durationLabel: '1 dia', price: 5.99 },
  weekly: { name: 'Semanal', emoji: '🔵', duration: '7d', durationLabel: '7 dias', price: 14.99 },
  monthly: { name: 'Mensal', emoji: '🟠', duration: '30d', durationLabel: '30 dias', price: 39.99 },
  annual: { name: 'Anual', emoji: '🔴', duration: '365d', durationLabel: '1 ano', price: 99.99 },
  lifetime: { name: 'Vitalício', emoji: '👑', duration: 'vitalicio', durationLabel: 'Vitalício', price: 139.99 }
};

const DURATION_LABELS = {
  '1m': '1 minuto', '5m': '5 minutos', '15m': '15 minutos', '30m': '30 minutos',
  '1h': '1 hora', '6h': '6 horas', '12h': '12 horas',
  '1d': '1 dia', '3d': '3 dias', '7d': '7 dias', '15d': '15 dias',
  '30d': '30 dias', '90d': '90 dias', '180d': '180 dias', '365d': '1 ano',
  vitalicio: 'Vitalício'
};

const DURATION_CODES = {
  '1m': 'A', '5m': 'B', '15m': 'C', '30m': 'D',
  '1h': 'E', '6h': 'F', '12h': 'G',
  '1d': 'H', '3d': 'I', '7d': 'J', '15d': 'K',
  '30d': 'L', '90d': 'M', '180d': 'N', '365d': 'O',
  vitalicio: 'Z'
};

fs.mkdirSync(CONFIG.dataDir, { recursive: true });

const FILES = {
  keys: path.join(CONFIG.dataDir, 'keys.json'),
  banned: path.join(CONFIG.dataDir, 'banned.json'),
  carts: path.join(CONFIG.dataDir, 'carts.json'),
  sales: path.join(CONFIG.dataDir, 'sales.json')
};

function loadJson(file, fallback = []) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`Erro lendo ${path.basename(file)}:`, error.message);
    return fallback;
  }
}

function saveJson(file, data) {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2));
  fs.renameSync(temp, file);
}

for (const file of Object.values(FILES)) {
  if (!fs.existsSync(file)) saveJson(file, []);
}

function formatPrice(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function safeChannelName(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 40) || 'cliente';
}

function isStaff(member) {
  return member?.roles?.cache?.some((role) => role.name === CONFIG.staffRole);
}

function isReseller(member) {
  return member?.roles?.cache?.some((role) => role.name === CONFIG.allowedRole);
}

function hasKeyPermission(member) {
  return isStaff(member) || isReseller(member);
}

function generateKey(duration) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randomBlock = () => Array.from(
    { length: 4 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join('');

  const block1 = randomBlock();
  const block2 = randomBlock();
  const randomThird = randomBlock();
  const block3 = (DURATION_CODES[duration] || 'Z') + randomThird.slice(1);
  const body = block1 + block2 + block3;

  let hash = 0;
  const source = body + CONFIG.masterKey;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(i);
    hash |= 0;
  }

  const checksum = Math.abs(hash)
    .toString(36)
    .toUpperCase()
    .padStart(8, '0')
    .slice(0, 8);

  return `KL-${block1}-${block2}-${block3}-${checksum}`;
}

async function sendLog(title, responsible, details, color = '#ff3333') {
  try {
    if (!CONFIG.logsChannelId) return;
    const channel = await client.channels.fetch(CONFIG.logsChannelId).catch(() => null);
    if (!channel?.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(color)
      .addFields(
        { name: '👤 Responsável', value: responsible || 'Sistema', inline: true },
        { name: '⏰ Data', value: new Date().toLocaleString('pt-BR'), inline: true }
      )
      .setDescription(details || 'Sem detalhes.')
      .setFooter({ text: 'King Lovable • Logs' })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Erro enviando log:', error.message);
  }
}

function emvField(id, value) {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

function normalizePixText(value, maxLength) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 $%*+\-./:]/g, '')
    .trim()
    .slice(0, maxLength);
}

function crc16(payload) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function createPixPayload({ key, name, city, amount, txid }) {
  const merchantAccount = emvField('00', 'BR.GOV.BCB.PIX') + emvField('01', key);
  const additional = emvField('05', normalizePixText(txid || '***', 25) || '***');

  let payload = '';
  payload += emvField('00', '01');
  payload += emvField('01', '12');
  payload += emvField('26', merchantAccount);
  payload += emvField('52', '0000');
  payload += emvField('53', '986');
  payload += emvField('54', Number(amount).toFixed(2));
  payload += emvField('58', 'BR');
  payload += emvField('59', normalizePixText(name, 25));
  payload += emvField('60', normalizePixText(city, 15));
  payload += emvField('62', additional);
  payload += '6304';
  return payload + crc16(payload);
}

function getCartByChannel(channelId) {
  return loadJson(FILES.carts).find((cart) => cart.channelId === channelId);
}

function getOpenCartByUser(userId) {
  return loadJson(FILES.carts).find(
    (cart) => cart.userId === userId && ['pending', 'awaiting_review'].includes(cart.status)
  );
}

function updateCart(channelId, changes) {
  const carts = loadJson(FILES.carts);
  const index = carts.findIndex((cart) => cart.channelId === channelId);
  if (index === -1) return null;
  carts[index] = { ...carts[index], ...changes, updatedAt: new Date().toISOString() };
  saveJson(FILES.carts, carts);
  return carts[index];
}

function panelEmbed() {
  const description = Object.values(PLANS)
    .map((plan) => `${plan.emoji} **${plan.name}** — ${formatPrice(plan.price)} • ${plan.durationLabel}`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setAuthor({ name: 'King Lovable' })
    .setTitle('⚡ Entrega após confirmação!')
    .setDescription(
      'Escolha um dos planos King Lovable e crie seu carrinho privado.\n\n' +
      `${description}\n\n` +
      '🔒 Pagamento via Pix com atendimento privado.'
    )
    .setColor('#ffd700')
    .setFooter({ text: 'King Lovable • Selecione um plano abaixo' });

  if (CONFIG.panelImageUrl) embed.setImage(CONFIG.panelImageUrl);
  return embed;
}

function planSelectRow() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('sales_plan_select')
      .setPlaceholder('Clique aqui para ver os planos')
      .addOptions(
        Object.entries(PLANS).map(([value, plan]) => ({
          label: `King Lovable ${plan.name}`,
          description: `${formatPrice(plan.price)} • ${plan.durationLabel}`,
          emoji: plan.emoji,
          value
        }))
      )
  );
}

function cartEmbed(user, plan, status = 'pending') {
  const statusLabel = {
    pending: '🟡 Aguardando pagamento',
    awaiting_review: '🟠 Pagamento em análise',
    paid: '🟢 Pagamento confirmado',
    cancelled: '🔴 Cancelado'
  }[status] || status;

  const embed = new EmbedBuilder()
    .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
    .setTitle('Finalizando carrinho')
    .setDescription(`Olá ${user}, confira seu pedido antes de continuar.`)
    .addFields(
      { name: '🛒 Produto', value: `1× King Lovable ${plan.name}`, inline: true },
      { name: '💰 Valor à vista', value: formatPrice(plan.price), inline: true },
      { name: '📅 Duração', value: plan.durationLabel, inline: true },
      { name: '📋 Status', value: statusLabel, inline: false }
    )
    .setColor(status === 'paid' ? '#22c55e' : '#ffd700')
    .setFooter({ text: 'King Lovable • Carrinho privado' });

  if (CONFIG.panelImageUrl) embed.setImage(CONFIG.panelImageUrl);
  return embed;
}

function cartButtons(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('cart_payment')
      .setLabel('Ir para pagamento')
      .setEmoji('💳')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('cart_cancel')
      .setLabel('Cancelar')
      .setEmoji('✖️')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );
}

const commandDefinitions = [
  {
    name: 'painelvendas',
    description: '🛒 Publicar o painel de vendas neste canal (Staff)'
  },
  {
    name: 'pago',
    description: '✅ Confirmar o pagamento do carrinho atual (Staff)'
  },
  {
    name: 'gerarkey',
    description: '🔑 Gerar uma nova key',
    options: [
      {
        name: 'duracao',
        description: 'Duração da key',
        type: 3,
        required: true,
        choices: Object.entries(DURATION_LABELS).map(([value, name]) => ({ name, value }))
      },
      {
        name: 'quantidade',
        description: 'Quantidade de keys (1–10)',
        type: 4,
        required: false
      },
      {
        name: 'cliente',
        description: 'Nome do cliente',
        type: 3,
        required: false
      }
    ]
  },
  { name: 'keys', description: '📊 Ver estatísticas de keys' },
  {
    name: 'relatorio',
    description: '📋 Relatório por revendedor',
    options: [{ name: 'revendedor', description: 'Nome', type: 3, required: false }]
  },
  {
    name: 'deletarkey',
    description: '🗑️ Apagar uma key (Staff)',
    options: [{ name: 'key', description: 'Key', type: 3, required: true }]
  },
  {
    name: 'ban',
    description: '🚫 Banir revendedor (Staff)',
    options: [{ name: 'usuario', description: 'Tag do usuário', type: 3, required: true }]
  },
  {
    name: 'unban',
    description: '✅ Desbanir revendedor (Staff)',
    options: [{ name: 'usuario', description: 'Tag do usuário', type: 3, required: true }]
  },
  {
    name: 'keyscliente',
    description: '🔍 Buscar keys por cliente (Staff)',
    options: [{ name: 'cliente', description: 'Nome', type: 3, required: true }]
  },
  {
    name: 'expirarkey',
    description: '⏰ Forçar expiração de key (Staff)',
    options: [{ name: 'key', description: 'Key', type: 3, required: true }]
  },
  {
    name: 'statuskey',
    description: '🔍 Ver detalhes de uma key (Staff)',
    options: [{ name: 'key', description: 'Key', type: 3, required: true }]
  },
  { name: 'limparlogs', description: '🧹 Remover keys expiradas (Staff)' },
  { name: 'fecharticket', description: '🔒 Fechar ticket ou carrinho (Staff)' }
];

async function ensureSupportPanel() {
  if (!CONFIG.ticketChannelId) return;
  const channel = await client.channels.fetch(CONFIG.ticketChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const messages = await channel.messages.fetch({ limit: 20 });
  const exists = messages.some(
    (message) => message.author.id === client.user.id &&
      message.components.some((row) => row.components.some((item) => item.customId === 'open_ticket'))
  );
  if (exists) return;

  const embed = new EmbedBuilder()
    .setTitle('⚡┃King Atendimento')
    .setDescription(
      '📦 **Abra este ticket para:**\n' +
      '• Resgatar seu produto\n• Enviar comprovante\n• Tirar dúvidas\n• Solicitar suporte\n\n' +
      '🔒 Nosso atendimento é seguro e privado.'
    )
    .setColor('#ffd700');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_ticket')
      .setLabel('Abrir Ticket')
      .setEmoji('📩')
      .setStyle(ButtonStyle.Danger)
  );
  await channel.send({ embeds: [embed], components: [row] });
}

client.once('ready', async () => {
  console.log(`🤖 ${client.user.tag} online.`);
  const guild = await client.guilds.fetch(CONFIG.guildId).catch(() => null);
  if (!guild) {
    console.error('Servidor não encontrado. Confira GUILD_ID.');
    return;
  }

  await guild.commands.set(commandDefinitions);
  await ensureSupportPanel().catch((error) => console.error('Painel de suporte:', error.message));
  console.log('✅ Comandos e painéis carregados.');
});

async function createSalesCart(interaction, planId) {
  const plan = PLANS[planId];
  if (!plan) return interaction.reply({ content: '❌ Plano inválido.', ephemeral: true });
  if (!CONFIG.salesCategoryId) {
    return interaction.reply({
      content: '❌ A categoria de vendas ainda não foi configurada pela equipe.',
      ephemeral: true
    });
  }

  const previous = getOpenCartByUser(interaction.user.id);
  if (previous) {
    const channel = interaction.guild.channels.cache.get(previous.channelId);
    if (channel) {
      return interaction.reply({
        content: `🛒 Você já possui um carrinho aberto: ${channel}`,
        ephemeral: true
      });
    }
    updateCart(previous.channelId, { status: 'cancelled', cancelReason: 'channel_missing' });
  }

  await interaction.deferReply({ ephemeral: true });

  const staffRole = interaction.guild.roles.cache.find((role) => role.name === CONFIG.staffRole);
  const overwrites = [
    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    },
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ReadMessageHistory
      ]
    }
  ];
  if (staffRole) {
    overwrites.push({
      id: staffRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  const channel = await interaction.guild.channels.create({
    name: `carrinho-${safeChannelName(interaction.user.username)}`,
    type: ChannelType.GuildText,
    parent: CONFIG.salesCategoryId,
    permissionOverwrites: overwrites,
    topic: `Carrinho King Lovable • Cliente: ${interaction.user.id} • Plano: ${planId}`
  });

  const carts = loadJson(FILES.carts);
  carts.unshift({
    id: `KL${Date.now()}`,
    channelId: channel.id,
    userId: interaction.user.id,
    userTag: interaction.user.tag,
    planId,
    amount: plan.price,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  saveJson(FILES.carts, carts);

  await channel.send({
    content: `${interaction.user}`,
    embeds: [cartEmbed(interaction.user, plan)],
    components: [cartButtons()]
  });
  await interaction.editReply({ content: `✅ Carrinho criado: ${channel}` });
}

async function showPixPayment(interaction) {
  const cart = getCartByChannel(interaction.channelId);
  if (!cart) return interaction.reply({ content: '❌ Carrinho não encontrado.', ephemeral: true });
  if (interaction.user.id !== cart.userId) {
    return interaction.reply({ content: '❌ Este carrinho pertence a outro cliente.', ephemeral: true });
  }
  if (cart.status !== 'pending') {
    return interaction.reply({ content: 'ℹ️ Este pagamento já foi enviado para análise.', ephemeral: true });
  }
  if (!CONFIG.pixKey || !CONFIG.pixReceiverName || !CONFIG.pixReceiverCity) {
    return interaction.reply({
      content: '❌ O Pix ainda não foi configurado. Avise a equipe.',
      ephemeral: true
    });
  }

  await interaction.deferReply();
  const plan = PLANS[cart.planId];
  const txid = cart.id.replace(/[^A-Z0-9]/gi, '').slice(0, 25);
  const payload = createPixPayload({
    key: CONFIG.pixKey,
    name: CONFIG.pixReceiverName,
    city: CONFIG.pixReceiverCity,
    amount: cart.amount,
    txid
  });
  const qrBuffer = await QRCode.toBuffer(payload, {
    type: 'png',
    width: 520,
    margin: 2,
    errorCorrectionLevel: 'M'
  });
  const attachment = new AttachmentBuilder(qrBuffer, { name: `pix-${cart.id}.png` });

  const embed = new EmbedBuilder()
    .setTitle('Pagamento via Pix criado')
    .setDescription(
      `**Plano:** King Lovable ${plan.name}\n` +
      `**Valor:** ${formatPrice(cart.amount)}\n\n` +
      '**Código Pix copia e cola:**\n' +
      `\`\`\`\n${payload}\n\`\`\`\n` +
      'Após pagar, clique em **Já paguei** para avisar a equipe.'
    )
    .setImage(`attachment://pix-${cart.id}.png`)
    .setColor('#22c55e')
    .setFooter({ text: `Pedido ${cart.id} • A confirmação é feita pela equipe` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('cart_paid_notice')
      .setLabel('Já paguei')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('cart_cancel')
      .setLabel('Cancelar')
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.editReply({ embeds: [embed], files: [attachment], components: [row] });
}

async function notifyPaid(interaction) {
  const cart = getCartByChannel(interaction.channelId);
  if (!cart || cart.userId !== interaction.user.id) {
    return interaction.reply({ content: '❌ Carrinho inválido.', ephemeral: true });
  }
  if (cart.status === 'awaiting_review') {
    return interaction.reply({ content: 'ℹ️ A equipe já foi avisada.', ephemeral: true });
  }
  if (cart.status !== 'pending') {
    return interaction.reply({ content: '❌ Este carrinho não está aguardando pagamento.', ephemeral: true });
  }

  updateCart(interaction.channelId, {
    status: 'awaiting_review',
    paymentNotifiedAt: new Date().toISOString()
  });

  const staffRole = interaction.guild.roles.cache.find((role) => role.name === CONFIG.staffRole);
  const embed = new EmbedBuilder()
    .setTitle('🔎 Pagamento aguardando conferência')
    .setDescription(
      `${interaction.user} informou que realizou o Pix.\n\n` +
      'Confira o recebimento no banco. Se estiver correto, execute `/pago` neste canal.'
    )
    .setColor('#f59e0b')
    .setTimestamp();

  await interaction.update({ components: [] });
  await interaction.channel.send({
    content: staffRole ? `${staffRole}` : 'Equipe de atendimento',
    embeds: [embed],
    allowedMentions: staffRole ? { roles: [staffRole.id] } : { parse: [] }
  });
  await sendLog(
    '💸 Pagamento informado',
    interaction.user.tag,
    `Pedido: \`${cart.id}\`\nPlano: **${PLANS[cart.planId].name}**\nValor: **${formatPrice(cart.amount)}**`,
    '#f59e0b'
  );
}

async function finalizeSale(interaction) {
  const cart = getCartByChannel(interaction.channelId);
  if (!cart) return interaction.reply({ content: '❌ Use `/pago` dentro de um carrinho.', ephemeral: true });
  if (cart.status === 'paid') return interaction.reply({ content: 'ℹ️ Este pedido já foi entregue.', ephemeral: true });
  if (!['pending', 'awaiting_review'].includes(cart.status)) {
    return interaction.reply({ content: '❌ Este pedido está cancelado.', ephemeral: true });
  }

  await interaction.deferReply();
  const plan = PLANS[cart.planId];
  const license = {
    key: generateKey(plan.duration),
    plan: cart.planId,
    client: cart.userTag,
    clientId: cart.userId,
    revendedor: interaction.user.tag,
    duration: plan.durationLabel,
    durationCode: plan.duration,
    created: new Date().toISOString(),
    status: 'active',
    orderId: cart.id
  };

  const keys = loadJson(FILES.keys);
  keys.unshift(license);
  saveJson(FILES.keys, keys);

  const sale = {
    orderId: cart.id,
    userId: cart.userId,
    userTag: cart.userTag,
    planId: cart.planId,
    planName: plan.name,
    duration: plan.durationLabel,
    amount: cart.amount,
    paymentMethod: 'pix_manual',
    confirmedById: interaction.user.id,
    confirmedByTag: interaction.user.tag,
    key: license.key,
    paidAt: new Date().toISOString()
  };
  const sales = loadJson(FILES.sales);
  sales.unshift(sale);
  saveJson(FILES.sales, sales);
  updateCart(interaction.channelId, {
    status: 'paid',
    paidAt: sale.paidAt,
    confirmedById: interaction.user.id,
    key: license.key
  });

  const buyer = await client.users.fetch(cart.userId);
  let customerRoleAdded = false;
  if (CONFIG.customerRoleId) {
    try {
      const buyerMember = await interaction.guild.members.fetch(cart.userId);
      await buyerMember.roles.add(CONFIG.customerRoleId, `Compra confirmada • Pedido ${cart.id}`);
      customerRoleAdded = true;
    } catch (error) {
      await sendLog(
        '⚠️ Cargo de cliente não adicionado',
        interaction.user.tag,
        `Pedido: \`${cart.id}\`\nCliente: <@${cart.userId}>\nErro: \`${error.message}\``,
        '#f59e0b'
      );
    }
  }

  const deliveryEmbed = new EmbedBuilder()
    .setTitle('👑 Sua key King Lovable chegou!')
    .setDescription(
      `**Plano:** ${plan.name}\n` +
      `**Duração:** ${plan.durationLabel}\n\n` +
      `**Sua key:**\n\`\`\`\n${license.key}\n\`\`\`\n` +
      'Guarde esta mensagem em um local seguro.'
    )
    .setColor('#ffd700')
    .setFooter({ text: `Pedido ${cart.id}` })
    .setTimestamp();

  let deliveredByDm = true;
  try {
    await buyer.send({ embeds: [deliveryEmbed] });
  } catch {
    deliveredByDm = false;
    await interaction.channel.send({ content: `${buyer}`, embeds: [deliveryEmbed] });
  }

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setTitle('✅ Pagamento confirmado e produto entregue')
        .setDescription(
          `${buyer}, sua key foi entregue ${deliveredByDm ? 'por mensagem privada' : 'neste carrinho'}.\n\n` +
          `Confirmado por ${interaction.user}.\n` +
          `Cargo de cliente: ${customerRoleAdded ? '✅ Adicionado' : CONFIG.customerRoleId ? '⚠️ Não foi possível adicionar' : '➖ Não configurado'}`
        )
        .setColor('#22c55e')
        .setFooter({ text: 'O carrinho será fechado em 30 segundos.' })
    ]
  });

  await sendLog(
    '✅ Venda concluída',
    interaction.user.tag,
    `Pedido: \`${cart.id}\`\nCliente: <@${cart.userId}>\nPlano: **${plan.name}**\n` +
      `Valor: **${formatPrice(cart.amount)}**\nKey: \`${license.key}\``,
    '#22c55e'
  );

  await interaction.channel.setName(`pago-${safeChannelName(cart.userTag)}`).catch(() => {});
  setTimeout(() => interaction.channel.delete().catch(() => {}), 30_000);
}

async function cancelCart(interaction) {
  const cart = getCartByChannel(interaction.channelId);
  if (!cart) return interaction.reply({ content: '❌ Carrinho não encontrado.', ephemeral: true });
  if (interaction.user.id !== cart.userId && !isStaff(interaction.member)) {
    return interaction.reply({ content: '❌ Você não pode cancelar este carrinho.', ephemeral: true });
  }
  if (cart.status === 'paid') {
    return interaction.reply({ content: '❌ Uma venda concluída não pode ser cancelada.', ephemeral: true });
  }

  updateCart(interaction.channelId, {
    status: 'cancelled',
    cancelledBy: interaction.user.id,
    cancelledAt: new Date().toISOString()
  });
  await interaction.reply({ content: '❌ Carrinho cancelado. Este canal será fechado em 10 segundos.' });
  await sendLog('❌ Carrinho cancelado', interaction.user.tag, `Pedido: \`${cart.id}\``, '#ef4444');
  setTimeout(() => interaction.channel.delete().catch(() => {}), 10_000);
}

async function openSupportTicket(interaction) {
  if (!CONFIG.ticketCategoryId) {
    return interaction.reply({ content: '❌ Categoria de suporte não configurada.', ephemeral: true });
  }
  const existing = interaction.guild.channels.cache.find(
    (channel) => channel.topic === `support-owner:${interaction.user.id}`
  );
  if (existing) {
    return interaction.reply({ content: `❌ Você já tem um ticket aberto: ${existing}`, ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });
  const staffRole = interaction.guild.roles.cache.find((role) => role.name === CONFIG.staffRole);
  const overwrites = [
    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles
      ]
    },
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels
      ]
    }
  ];
  if (staffRole) {
    overwrites.push({
      id: staffRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  const channel = await interaction.guild.channels.create({
    name: `ticket-${safeChannelName(interaction.user.username)}`,
    type: ChannelType.GuildText,
    parent: CONFIG.ticketCategoryId,
    topic: `support-owner:${interaction.user.id}`,
    permissionOverwrites: overwrites
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('close_ticket').setLabel('Fechar').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('resolve_ticket').setLabel('Resolvido').setEmoji('✅').setStyle(ButtonStyle.Success)
  );
  await channel.send({
    content: `${interaction.user}`,
    embeds: [
      new EmbedBuilder()
        .setTitle('🎫 Atendimento King Lovable')
        .setDescription(`Olá ${interaction.user}, descreva como podemos ajudar.`)
        .setColor('#ffd700')
    ],
    components: [row]
  });
  await interaction.editReply({ content: `✅ Ticket criado: ${channel}` });
}

async function handleButton(interaction) {
  switch (interaction.customId) {
    case 'open_ticket':
      return openSupportTicket(interaction);
    case 'close_ticket':
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: '❌ Apenas a staff pode fechar.', ephemeral: true });
      }
      await interaction.reply({ content: '🔒 Fechando em 5 segundos...' });
      return setTimeout(() => interaction.channel.delete().catch(() => {}), 5_000);
    case 'resolve_ticket':
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: '❌ Apenas a staff pode resolver.', ephemeral: true });
      }
      await interaction.reply({ content: '✅ Resolvido. Fechando em 10 segundos...' });
      return setTimeout(() => interaction.channel.delete().catch(() => {}), 10_000);
    case 'cart_payment': {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cart_pix').setLabel('Pix').setEmoji('💠').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('cart_back').setLabel('Voltar').setStyle(ButtonStyle.Secondary)
      );
      return interaction.reply({ content: 'Selecione uma forma de pagamento:', components: [row], ephemeral: true });
    }
    case 'cart_pix':
      return showPixPayment(interaction);
    case 'cart_back':
      return interaction.update({ content: 'Operação cancelada.', components: [] });
    case 'cart_paid_notice':
      return notifyPaid(interaction);
    case 'cart_cancel':
      return cancelCart(interaction);
    default:
      return null;
  }
}

async function handleCommand(interaction) {
  const command = interaction.commandName;
  const banned = loadJson(FILES.banned);
  if (banned.includes(interaction.user.tag) && !isStaff(interaction.member)) {
    return interaction.reply({ content: '🚫 Você está impedido de usar este bot.', ephemeral: true });
  }

  const staffCommands = new Set([
    'painelvendas', 'pago', 'relatorio', 'deletarkey', 'ban', 'unban',
    'keyscliente', 'expirarkey', 'statuskey', 'limparlogs', 'fecharticket'
  ]);
  if (staffCommands.has(command) && !isStaff(interaction.member)) {
    return interaction.reply({ content: '❌ Comando exclusivo da staff.', ephemeral: true });
  }
  if (['gerarkey', 'keys'].includes(command) && !hasKeyPermission(interaction.member)) {
    return interaction.reply({ content: '❌ Você não possui permissão.', ephemeral: true });
  }

  if (command === 'painelvendas') {
    await interaction.channel.send({ embeds: [panelEmbed()], components: [planSelectRow()] });
    return interaction.reply({ content: '✅ Painel de vendas publicado.', ephemeral: true });
  }
  if (command === 'pago') return finalizeSale(interaction);

  if (command === 'gerarkey') {
    const duration = interaction.options.getString('duracao');
    const quantity = interaction.options.getInteger('quantidade') || 1;
    const clientName = interaction.options.getString('cliente') || 'N/A';
    if (quantity < 1 || quantity > 10) {
      return interaction.reply({ content: '❌ A quantidade deve ser de 1 a 10.', ephemeral: true });
    }

    const generated = Array.from({ length: quantity }, () => ({
      key: generateKey(duration),
      plan: 'manual',
      client: clientName,
      revendedor: interaction.user.tag,
      duration: DURATION_LABELS[duration],
      durationCode: duration,
      created: new Date().toISOString(),
      status: 'active'
    }));
    const allKeys = loadJson(FILES.keys);
    allKeys.unshift(...generated);
    saveJson(FILES.keys, allKeys);

    await sendLog(
      '🔑 Keys geradas',
      interaction.user.tag,
      `Quantidade: **${quantity}**\nDuração: **${DURATION_LABELS[duration]}**\n` +
        `Cliente: **${clientName}**\n${generated.map((item) => `\`${item.key}\``).join('\n')}`
    );
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🔑 Key(s) gerada(s)')
          .setDescription(generated.map((item) => `\`${item.key}\``).join('\n'))
          .addFields(
            { name: 'Duração', value: DURATION_LABELS[duration], inline: true },
            { name: 'Cliente', value: clientName, inline: true }
          )
          .setColor('#ff3333')
      ],
      ephemeral: true
    });
  }

  if (command === 'keys') {
    const keys = loadJson(FILES.keys);
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('📊 Estatísticas')
          .addFields(
            { name: 'Total', value: String(keys.length), inline: true },
            { name: 'Ativas', value: String(keys.filter((item) => item.status === 'active').length), inline: true },
            { name: 'Expiradas', value: String(keys.filter((item) => item.status === 'expired').length), inline: true }
          )
          .setColor('#ffd700')
      ],
      ephemeral: true
    });
  }

  if (command === 'relatorio') {
    const filter = interaction.options.getString('revendedor');
    let keys = loadJson(FILES.keys);
    if (filter) {
      keys = keys.filter((item) => item.revendedor?.toLowerCase().includes(filter.toLowerCase()));
    }
    const grouped = {};
    for (const item of keys) {
      const owner = item.revendedor || 'N/A';
      grouped[owner] ||= { total: 0, active: 0 };
      grouped[owner].total += 1;
      if (item.status === 'active') grouped[owner].active += 1;
    }
    const description = Object.entries(grouped)
      .map(([owner, stats]) => `**${owner}**\n📦 ${stats.total} • 🟢 ${stats.active}`)
      .join('\n\n') || 'Nenhuma key encontrada.';
    return interaction.reply({
      embeds: [new EmbedBuilder().setTitle('📋 Relatório').setDescription(description.slice(0, 4000)).setColor('#ffd700')],
      ephemeral: true
    });
  }

  if (command === 'deletarkey') {
    const key = interaction.options.getString('key').trim().toUpperCase();
    const keys = loadJson(FILES.keys);
    const filtered = keys.filter((item) => item.key !== key);
    if (filtered.length === keys.length) {
      return interaction.reply({ content: '❌ Key não encontrada.', ephemeral: true });
    }
    saveJson(FILES.keys, filtered);
    await sendLog('🗑️ Key apagada', interaction.user.tag, `\`${key}\``);
    return interaction.reply({ content: '✅ Key apagada.', ephemeral: true });
  }

  if (command === 'ban' || command === 'unban') {
    const userTag = interaction.options.getString('usuario');
    let bannedUsers = loadJson(FILES.banned);
    if (command === 'ban') {
      if (!bannedUsers.includes(userTag)) bannedUsers.push(userTag);
    } else {
      bannedUsers = bannedUsers.filter((item) => item !== userTag);
    }
    saveJson(FILES.banned, bannedUsers);
    await sendLog(command === 'ban' ? '🚫 Usuário banido' : '✅ Usuário desbanido', interaction.user.tag, userTag);
    return interaction.reply({
      content: command === 'ban' ? `🚫 ${userTag} foi banido.` : `✅ ${userTag} foi desbanido.`,
      ephemeral: true
    });
  }

  if (command === 'keyscliente') {
    const filter = interaction.options.getString('cliente').toLowerCase();
    const keys = loadJson(FILES.keys).filter((item) => item.client?.toLowerCase().includes(filter));
    if (!keys.length) return interaction.reply({ content: '❌ Nenhuma key encontrada.', ephemeral: true });
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`🔍 Resultado: ${filter}`)
          .setDescription(keys.slice(0, 20).map((item) => `\`${item.key}\` • ${item.duration}`).join('\n'))
          .setColor('#ffd700')
      ],
      ephemeral: true
    });
  }

  if (command === 'expirarkey') {
    const key = interaction.options.getString('key').trim().toUpperCase();
    const keys = loadJson(FILES.keys);
    const found = keys.find((item) => item.key === key);
    if (!found) return interaction.reply({ content: '❌ Key não encontrada.', ephemeral: true });
    found.status = 'expired';
    found.expiredAt = new Date().toISOString();
    saveJson(FILES.keys, keys);
    return interaction.reply({ content: '✅ Key marcada como expirada.', ephemeral: true });
  }

  if (command === 'statuskey') {
    const key = interaction.options.getString('key').trim().toUpperCase();
    const found = loadJson(FILES.keys).find((item) => item.key === key);
    if (!found) return interaction.reply({ content: '❌ Key não encontrada.', ephemeral: true });
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🔍 Status da key')
          .addFields(
            { name: 'Key', value: `\`${found.key}\`` },
            { name: 'Status', value: found.status === 'active' ? '🟢 Ativa' : '🔴 Expirada', inline: true },
            { name: 'Cliente', value: found.client || 'N/A', inline: true },
            { name: 'Duração', value: found.duration || 'N/A', inline: true }
          )
          .setColor(found.status === 'active' ? '#22c55e' : '#ef4444')
      ],
      ephemeral: true
    });
  }

  if (command === 'limparlogs') {
    const keys = loadJson(FILES.keys);
    const active = keys.filter((item) => item.status !== 'expired');
    saveJson(FILES.keys, active);
    return interaction.reply({
      content: `✅ ${keys.length - active.length} key(s) expirada(s) removida(s).`,
      ephemeral: true
    });
  }

  if (command === 'fecharticket') {
    const isTicket = interaction.channel.name.startsWith('ticket-') ||
      interaction.channel.name.startsWith('carrinho-') ||
      interaction.channel.name.startsWith('pago-');
    if (!isTicket) return interaction.reply({ content: '❌ Este canal não é um ticket.', ephemeral: true });
    const cart = getCartByChannel(interaction.channelId);
    if (cart && cart.status !== 'paid') {
      updateCart(interaction.channelId, {
        status: 'cancelled',
        cancelledBy: interaction.user.id,
        cancelledAt: new Date().toISOString()
      });
    }
    await interaction.reply({ content: '🔒 Fechando em 5 segundos...' });
    return setTimeout(() => interaction.channel.delete().catch(() => {}), 5_000);
  }

  return null;
}

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isStringSelectMenu() && interaction.customId === 'sales_plan_select') {
      return await createSalesCart(interaction, interaction.values[0]);
    }
    if (interaction.isButton()) return await handleButton(interaction);
    if (interaction.isChatInputCommand()) return await handleCommand(interaction);
  } catch (error) {
    console.error('Erro em interactionCreate:', error);
    const payload = { content: '❌ Ocorreu um erro. A equipe foi avisada.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
    await sendLog('⚠️ Erro interno', interaction.user?.tag || 'Desconhecido', `\`${error.message}\``);
  }
});

client.on('guildMemberAdd', async (member) => {
  try {
    const role = member.guild.roles.cache.find((item) => item.name === CONFIG.memberRole);
    if (role) await member.roles.add(role);

    if (CONFIG.welcomeChannelId) {
      const channel = await member.guild.channels.fetch(CONFIG.welcomeChannelId).catch(() => null);
      if (channel?.isTextBased()) {
        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('👋 Bem-vindo(a)!')
              .setDescription(`Bem-vindo(a) ao servidor, ${member}! 🎉`)
              .setColor('#ffd700')
          ]
        });
      }
    }
  } catch (error) {
    console.error('Erro no boas-vindas:', error.message);
  }
});

client.login(process.env.DISCORD_TOKEN);
