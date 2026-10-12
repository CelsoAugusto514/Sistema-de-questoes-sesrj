# Simulador SES/RJ — GitHub + Vercel

Projeto completo para começar do zero. São **1.080 questões, distribuídas em 108 tópicos com 10 questões cada**. Nenhuma resposta, redação ou conta do site anterior está neste pacote.

**Comece pelo arquivo [COMECE-AQUI.md](COMECE-AQUI.md).** Ele explica a publicação, sem precisar conectar suas contas ao ChatGPT.

## Funcionalidades

- Português: 280 questões; SUS: 180; Informática: 240; Conhecimentos Específicos: 380.
- Uma questão por vez, alternativas embaralhadas e explicações das quatro opções após confirmar.
- Dez pontos essenciais para anotar em cada tópico.
- Treino do tópico: 10 questões. Treino misto da matéria: 20.
- Mini teste: 5 questões de uma matéria ou 20, sendo 5 de cada matéria.
- Bloco de 70: 10 de Português, 5 de SUS, 5 de Informática e 50 de Específicos.
- Revisão dos erros, desempenho por matéria e retomada da sessão.
- Seis propostas de redação, rascunhos salvos e lista de revisão. Sem nota automática.
- Login por senha e progresso persistente no PostgreSQL.

## Tecnologias

Next.js 16, React 19, TypeScript, Tailwind CSS e PostgreSQL Neon. A aplicação usa funções Node.js da Vercel. O projeto original foi adaptado: não depende de Cloudflare D1, Vinext, hospedagem Sites ou login do ChatGPT.

## Configuração

| Variável | Onde colocar | Finalidade |
| --- | --- | --- |
| `DATABASE_URL` | Vercel ou `.env.local` | Conexão de um banco Neon novo |
| `SITE_PASSWORD` | Vercel ou `.env.local` | Senha de acesso: 12 a 256 caracteres |
| `SESSION_SECRET` | Vercel ou `.env.local` | Segredo aleatório de pelo menos 32 caracteres |

Nenhuma variável usa o prefixo `NEXT_PUBLIC_`. Não coloque valores reais no GitHub. O arquivo `.env.example` contém somente nomes e orientações.

## Executar no computador

Instale Node.js 22.13 ou superior. Na pasta que contém `package.json`:

```bash
npm ci
```

Copie `.env.example` para `.env.local`, preencha as três variáveis e inicialize o banco **novo**:

```bash
npm run db:init
npm run dev
```

Abra `http://localhost:3000`. O comando de inicialização cria apenas a estrutura. Não importa histórico. Você também pode executar `db/schema.sql` no SQL Editor do Neon.

## Verificação

```bash
npm run typecheck
npm test
npm run build
```

Os testes validam as 1.080 questões, 108 tópicos, distribuição das alternativas, sessões completas de 10, 5, 20 e 70 questões, revisão de erros, idempotência, retomada, estatísticas e redação. O adaptador SQL é exercitado com PostgreSQL local via PGlite; o driver Neon é substituído pelo transportador local durante os testes. Os testes de autenticação verificam senha, assinatura, expiração, rotação, bloqueio de cabeçalho forjado, origem, limitação de tentativas e saída.

O banco Neon da sua conta e a publicação real na Vercel devem ser conferidos após a configuração. Este pacote não foi publicado na sua conta. Não foi feita uma inspeção visual automatizada em navegador.

## Estrutura do código

| Caminho | Conteúdo |
| --- | --- |
| `app/study-app.tsx` | Navegação, perguntas, correção e desempenho |
| `app/coverage-panel.tsx` | Mapa de tópicos e pontos de revisão |
| `app/essay-panel.tsx` | Redação e rascunhos |
| `app/login/page.tsx` | Tela de entrada |
| `app/api/study/route.ts` | Sessões, respostas e progresso |
| `app/api/essay/route.ts` | Persistência das redações |
| `app/api/auth/` | Login e saída |
| `lib/auth.ts` | Sessão assinada e verificação de origem |
| `lib/engine.ts` | Sorteio e distribuição das alternativas |
| `lib/question-bank.json` | Banco completo de perguntas, opções e explicações |
| `lib/syllabus.ts` | Matérias, tópicos e fontes |
| `lib/study-notes.json` | Dez pontos essenciais por tópico |
| `content/` | Conteúdo autoral usado para gerar o banco |
| `db/index.ts` | Adaptador PostgreSQL/Neon |
| `db/schema.sql` | Estrutura inicial, sem dados pessoais |
| `scripts/compile-bank.py` | Regeneração do banco com Python 3 |
| `scripts/validate-*.mjs` | Testes de fluxos e autenticação |

## Alterar perguntas

Edite os arquivos `content/*.txt`. Cada tópico começa com `@identificador` e tem dez linhas no formato:

```text
rótulo|afirmação verdadeira|afirmação falsa|explicação
```

Depois execute:

```bash
python scripts/compile-bank.py
npm test
npm run build
```

A primeira opção do arquivo do banco é a resposta correta; o motor embaralha as posições a cada sessão. O gabarito é entregue pela API somente após responder. As notas de estudo são acessíveis para revisão. Se alterar ou excluir identificadores de perguntas já respondidas, o histórico do banco novo poderá perder correspondência.

## Acesso privado

É um projeto pessoal com **uma senha e um histórico compartilhado por quem souber essa senha**. Não há cadastro separado para vários alunos. A sessão usa cookie HttpOnly, SameSite=Strict e Secure em HTTPS, com validade de sete dias. Trocar `SITE_PASSWORD` ou `SESSION_SECRET` invalida as sessões existentes.

O acesso às APIs exige sessão válida; um cabeçalho de usuário do ChatGPT não concede acesso. O login limita tentativas por IP em uma janela de 15 minutos. Os arquivos estáticos da interface e os resumos podem ser acessíveis por URL; não coloque dados confidenciais neles. Para restringir a entrega de todos os arquivos, inclusive assets, use proteção da implantação oferecida pela hospedagem conforme seu plano.

Não é necessário apagar nem modificar o site antigo. O novo banco deve ser exclusivo deste projeto. Não conecte produção e testes ao mesmo banco se você quiser separar os históricos.

## Conteúdo de estudo

Banco autoral organizado pelo conteúdo mapeado do edital 01/2026. As perguntas não são questões oficiais da banca; o material não promete aprovação e não substitui leitura do edital, fontes e prática de redação. Fontes e data da conferência estão na seção Conteúdo do edital. Revise o edital mais recente antes da prova.

## Referências técnicas

- [Next.js na Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Neon no Marketplace da Vercel](https://vercel.com/marketplace/neon)
- [Driver Neon](https://github.com/neondatabase/serverless)
- [Variáveis de ambiente da Vercel](https://vercel.com/docs/environment-variables)
