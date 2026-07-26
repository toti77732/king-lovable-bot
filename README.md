# King Lovable Bot v2

Bot de vendas semiautomático para Discord. O cliente escolhe um plano, recebe
um Pix com valor preenchido e envia o pagamento para análise. A staff confirma
com `/pago`, e o bot gera e entrega a licença.

## Instalação

1. Envie estes arquivos ao repositório conectado ao Railway.
2. Crie as variáveis descritas em `.env.example`.
3. Conecte um Railway Volume no caminho `/data`.
4. Defina `DATA_DIR=/data`.
5. Faça o deploy e use `/painelvendas` no canal de vendas.

O banner padrão fica em `assets/king-lovable-panel.png` e é enviado pelo
próprio bot, sem depender de hospedagem externa. `PANEL_IMAGE_URL` continua
opcional e, quando preenchida, substitui a imagem local.

O painel de revendedores usa `assets/king-lovable-reseller-panel.png` e é
publicado automaticamente no canal definido por `RESELLER_SALES_CHANNEL_ID`.
Após a confirmação com `/pago`, o comprador recebe o cargo configurado em
`RESELLER_ROLE_ID` e uma mensagem privada de boas-vindas.

Os logs operacionais são enviados para `LOGS_CHANNEL_ID`, incluindo geração e
expiração de keys, carrinhos, Pix, pagamentos, vendas, cargos, tickets,
entrada de membros, inicialização e erros.

## Teste gratuito

O painel de teste usa `assets/king-lovable-trial-panel.png` e é publicado
automaticamente em `TRIAL_CHANNEL_ID`. O usuário abre um ticket privado, envia
o print e aguarda a equipe usar os botões **Aprovar teste** ou **Recusar**.

Ao aprovar, o bot:

- gera uma key de 1 hora;
- envia a key no privado;
- adiciona temporariamente o cargo definido em `TRIAL_ROLE_ID`;
- registra a aprovação em `trials.json`;
- impede outra key aprovada para o mesmo Discord ID;
- remove o cargo depois de 1 hora, mesmo após reinicialização do bot.

O bot precisa das permissões `Manage Channels`, `Manage Roles`, `Send
Messages`, `Embed Links`, `Attach Files`, `Read Message History` e `Use
Application Commands`.

## Fluxo da venda

1. Cliente escolhe o plano no painel.
2. O bot cria um canal privado `carrinho-...`.
3. Cliente clica em **Ir para pagamento** e escolhe **Pix**.
4. O bot publica o QR Code e o código copia e cola.
5. Cliente clica em **Já paguei**.
6. A staff confere no banco e executa `/pago`.
7. O bot entrega a key por DM, adiciona o cargo de cliente e registra a venda.

## Migração futura para gateway

Os pedidos usam os estados `pending`, `awaiting_review`, `paid` e `cancelled`.
Uma integração futura pode confirmar a cobrança e chamar a mesma função de
finalização usada por `/pago`.
