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
