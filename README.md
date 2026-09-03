# MEMÓRIA

"Se foi combinado, o MEMÓRIA garante que será lembrado."

SaaS de accountability que faz check-ins diários (seg-sex, por texto ou voz) para capturar compromissos assumidos em reuniões e conversas, e transforma respostas em tarefas com prazo obrigatório, controle de prorrogação, metas, alertas automáticos, relatório de Entrega Semanal (com integração opcional ao Azure DevOps), dashboard executivo e auditoria — tudo nativo, sem IA externa, sem API keys obrigatórias e sem serviços pagos de terceiros.

## Stack

- Next.js 16 (App Router) + TypeScript, servido por um **custom server** (`server.ts`) para rodar o agendador de check-ins e a sincronização com o Azure DevOps.
- Prisma 7 + SQLite (`dev.db`, arquivo local) com driver adapter `better-sqlite3`.
- NextAuth v5 (Credentials) com bcrypt.
- Tailwind CSS v4, com a identidade visual ONCLICK (azul `#06A9F4`, amarelo `#FFF200`).
- `node-cron` para os check-ins agendados, as revisões semanais, os rascunhos de relatório e o job diário de alertas/atrasos.
- Recharts para os dashboards e Web Speech API (nativa do navegador) para check-in por voz.
- Web Speech API é opcional e degrada silenciosamente em navegadores sem suporte; a integração com Azure DevOps (variáveis `AZURE_DEVOPS_*` no `.env`) também é opcional — sem elas, o app funciona normalmente com atualização manual de números.

## Pré-requisitos

Node.js 20+ e npm.

## Como rodar

```bash
npm install
cp .env.example .env     # preencha AUTH_SECRET (openssl rand -base64 32); Azure DevOps é opcional
npx prisma migrate dev   # cria/atualiza dev.db
npx prisma db seed       # cria usuários e dados de demonstração
npm run dev              # sobe o app + agendador em http://localhost:3000
```

`npm run build` e `npm run start` empacotam e rodam a versão de produção (o `start` também sobe o custom server com o agendador).

## Expor o app fora da rede local (Cloudflare Tunnel)

Para testar o app a partir de outro dispositivo sem estar na mesma rede/VPN,
rode em outro terminal, com o `npm run dev` já ativo:

```bash
npm run tunnel            # expõe http://localhost:3000
PORT=4000 npm run tunnel  # expõe outra porta
```

O script (`scripts/tunnel.sh`) instala o [cloudflared](https://github.com/cloudflare/cloudflared)
automaticamente caso ele ainda não esteja no PATH (via Homebrew no macOS, ou
baixando o binário no Linux) e abre um túnel rápido, exibindo uma URL pública
temporária (`https://*.trycloudflare.com`) — não é necessário ter conta ou
domínio no Cloudflare.

## Rodar permanentemente em uma máquina própria (túnel nomeado do Cloudflare)

Para deixar o MEMÓRIA no ar continuamente numa máquina (ex: um PC/servidor
Windows), em vez do túnel rápido e temporário da seção acima, use um **túnel
nomeado**, vinculado a uma conta Cloudflare — ele fica registrado no
dashboard e não muda de URL.

1. **Suba o app como processo de produção nessa máquina:**
   ```bash
   npm install
   cp .env.example .env      # preencha AUTH_SECRET e as demais variáveis
   npx prisma migrate deploy
   npx prisma db seed        # apenas na primeira vez
   npm run build
   npm run start              # roda em http://localhost:3000
   ```
   Para sobreviver a reinicializações/logout no Windows, registre esse
   processo como serviço (ex: com o [NSSM](https://nssm.cc/)), apontando para
   `npm run start` com o diretório de trabalho na pasta do projeto.

2. **Crie o túnel nomeado no dashboard da Cloudflare** (Zero Trust → Networks
   → Tunnels → Create a tunnel) e instale-o como serviço na máquina com o
   comando gerado lá:
   ```
   cloudflared.exe service install <token>
   ```
   Isso registra o serviço `Cloudflared` no Windows, iniciando junto com o
   sistema. Confira com `sc query Cloudflared` (estado `RUNNING`).

   > **Nunca cole esse token em commits, issues ou mensagens** — ele dá
   > acesso para criar conexões em nome do seu túnel. Se ele for exposto (ex:
   > compartilhado em um chat), revogue-o e gere um novo no dashboard.

3. **Configure o "Public Hostname"** do túnel, no mesmo dashboard, apontando
   para `http://localhost:3000` (ou a porta configurada em `PORT`).

4. Acesse a URL pública configurada para confirmar que o app está no ar.

## Contas de demonstração

Todas com a senha `memoria123`:

| Perfil | E-mail |
| --- | --- |
| Administrador | admin@memoria.app |
| Líder | lider@memoria.app |
| Usuário | usuario@memoria.app |

## Identidade visual

A logo enviada não pôde ser processada (falha de mídia no upload). O wordmark "MEMÓRIA" em `components/brand/logo.tsx` foi recriado com a paleta e o estilo ONCLICK descritos no briefing. Para usar a logo oficial, basta trocar o conteúdo desse componente por um `<img>`/SVG apontando para o arquivo real — é o único lugar que precisa mudar (login, cabeçalho, menu lateral e certificados já o referenciam).

## Estrutura

- `prisma/schema.prisma` — modelo de dados completo (usuários, check-ins, tarefas, metas, alertas, auditoria).
- `lib/services/` — motor de check-in (heurística de resposta acionável), motor de alertas/risco e geração de certificados.
- `server.ts` — servidor customizado que agenda os check-ins (seg-sex, horários configuráveis em `/admin`), as revisões semanais (segunda e sexta às 08:30), os rascunhos de relatório de Entrega Semanal, a sincronização com o Azure DevOps e o recálculo diário de atrasos/alertas (00:05).
- `app/(app)/` — todas as telas autenticadas: Painel, Check-in, Tarefas, Metas, Revisão Semanal, Entrega Semanal, Alertas, Dashbord (executivo), Auditoria, Administração e Configurações.
