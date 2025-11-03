# 🚀 Template Backend Fastify

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-4.0+-red.svg)](https://www.fastify.io/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-orange.svg)](https://orm.drizzle.team/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13+-blue.svg)](https://www.postgresql.org/)

Template completo para APIs Node.js com **Fastify + TypeScript + Drizzle ORM + PostgreSQL**. Inclui autenticação JWT, Google OAuth, healthchecks, CORS, documentação OpenAPI e arquitetura vertical slice.

## ✨ Funcionalidades

- 🔐 **Autenticação JWT** com assinatura segura
- 🌐 **Google OAuth 2.0** integrado
- 🗄️ **Drizzle ORM** com PostgreSQL
- 📚 **Documentação OpenAPI** (Swagger UI)
- 🏗️ **Arquitetura Vertical Slice**
- 🚦 **Healthchecks** (liveness/readiness)
- 🔄 **CORS** configurado
- 🐳 **Docker Compose** para PostgreSQL
- 📝 **TypeScript** com tipagem forte
- 🔧 **Scripts** prontos para desenvolvimento

## 🚀 Quick Start

### 1. Clone o template
```bash
git clone https://github.com/SEU_USUARIO/template-backend-fastify.git
cd template-backend-fastify
```

### 2. Configure as variáveis de ambiente
```bash
cp .env.example .env
# Edite o .env com suas configurações
```

### 3. Instale as dependências
```bash
npm install
```

### 4. Suba o banco de dados
```bash
npm run db:up
```

### 5. Execute as migrações
```bash
npm run db:migrate
```

### 6. Inicie o servidor
```bash
# Desenvolvimento (hot-reload)
npm run dev

# Produção
npm start
```

## 📋 Pré-requisitos

- **Node.js** 18+ (recomendado 20+)
- **PostgreSQL** 13+ (ou Docker)
- **npm** ou **yarn**

## 🛠️ Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia servidor com hot-reload |
| `npm start` | Inicia servidor em produção |
| `npm run build` | Compila TypeScript |
| `npm run db:up` | Sobe PostgreSQL via Docker |
| `npm run db:down` | Para PostgreSQL |
| `npm run db:logs` | Mostra logs do PostgreSQL |
| `npm run db:reset` | Reseta banco (remove dados) |
| `npm run db:migrate` | Gera e aplica migrações |

## 🔗 Endpoints

### Autenticação
- `POST /users/register` - Cadastro com email/senha
- `POST /users/login` - Login com email/senha  
- `GET /users/google` - Login via Google OAuth

### Sistema
- `GET /health` - Healthcheck (liveness)
- `GET /ready` - Readiness check
- `GET /docs` - Documentação Swagger UI
- `GET /openapi.yaml` - Spec OpenAPI

## 🏗️ Arquitetura

```
├── db/                    # Camada de dados
│   ├── index.ts          # Conexão Drizzle/Postgres
│   └── schema.ts         # Schemas do banco
├── users/                # Vertical slice de usuários
│   ├── handler.ts        # Endpoints Fastify
│   ├── repository.ts     # Acesso a dados
│   ├── schema.ts         # DTOs/validações
│   └── google.ts         # Integração OAuth
├── app.ts               # Configuração Fastify
├── docker-compose.yml   # PostgreSQL
└── openapi.yaml         # Documentação API
```

## 🔧 Configuração

### Variáveis de Ambiente (.env)

```bash
# Banco de dados
DATABASE_URL=postgres://user:password@localhost:5432/template_backend_fastify

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# JWT
JWT_SECRET=your-super-secret-jwt-key

# Servidor
PORT=3000
```

### Google OAuth Setup

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um projeto ou selecione existente
3. Ative a **Google+ API**
4. Crie credenciais OAuth 2.0
5. Configure **Authorized redirect URIs**:
   - `http://localhost:3000/users/google`
   - `https://yourdomain.com/users/google` (produção)

## 📚 Documentação

- **Swagger UI**: `http://localhost:3000/docs`
- **OpenAPI Spec**: `http://localhost:3000/openapi.yaml`

## 🐳 Docker

### PostgreSQL apenas
```bash
npm run db:up
```

### Aplicação completa (exemplo)
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🧪 Testando a API

### Cadastro
```bash
curl -X POST http://localhost:3000/users/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

### Login
```bash
curl -X POST http://localhost:3000/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

### Google OAuth
1. Acesse: `http://localhost:3000/users/google`
2. Autorize no Google
3. Receba o JWT

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'feat: adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🙏 Agradecimentos

- [Fastify](https://www.fastify.io/) - Framework web rápido
- [Drizzle ORM](https://orm.drizzle.team/) - ORM TypeScript-first
- [PostgreSQL](https://www.postgresql.org/) - Banco de dados relacional
- [Google OAuth](https://developers.google.com/identity) - Autenticação social

---

⭐ **Se este template te ajudou, deixe uma estrela!**