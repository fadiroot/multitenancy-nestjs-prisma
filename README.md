# Instruction

🚀 Starter Template for [NestJS](https://nestjs.com/), [Prisma](https://www.prisma.io/) and [PostgreSQL](https://www.postgresql.org/)

<br>

## Version
> @nest core packages
- [@nestjs/common](https://www.npmjs.com/package/@nestjs/common) 9.4.0
- [@nestjs/core](https://www.npmjs.com/package/@nestjs/core) 9.4.0
- [@nestjs/platform-express](https://www.npmjs.com/package/@nestjs/platform-express) 9.4.0
- [@nestjs/cli](https://www.npmjs.com/package/@nestjs/cli) 9.4.0
- [@nestjs/schematics](https://www.npmjs.com/package/@nestjs/schematics) 9.1.0

<br>

> prisma
- [prisma](https://github.com/prisma/prisma) 4.12.x

<br>

> typescript
- [typescript](https://github.com/microsoft/TypeScript) 4.7.x

<br>

> lint
- [eslint](https://github.com/eslint/eslint) 8.0.x
- [prettier](https://github.com/prettier/prettier) 2.3.x
- [husky](https://github.com/typicode/husky) 8.0.x
- [lint-staged](https://github.com/okonet/lint-staged) 13.2.x
- [@commitlint/cli](https://www.npmjs.com/package/@commitlint/cli) 17.6.x
- [@commitlint/config-conventional](https://www.npmjs.com/package/@commitlint/config-conventional) 17.6.x

<br>

## Features
#### 🔥 Quick Start
- You can **quickly start your project** and get started with development !
<br>

#### 😻 Efficient Web Framework
- **Nest.js** is a Node.js framework that supports efficient server-side application development !
<br>

#### 🔷 The Next Generation ORM
- **Prisma** is a modern ORM that makes it easy to access databases through a type-safe and intuitive API !
<br>

#### 🐘 Advanced Open-source Relational Database
- **PostgreSQL** is a powerful, open-source object-relational database system that provides reliability, data integrity, and correctness !
<br>

#### ⚙️ TypeScript's Strict Mode
- Improve type safety, reduce potential errors, and enhance code maintainability with TypeScript's **strict mode** !
<br>

#### 📦 Using Fast Package Manager
- **pnpm** is a fast and disk space efficient package manager for JavaScript projects !
<br>

#### 🚛 Automated Linting and Formatting
- Automated linting and formatting with **ESLint**, **Prettier** and **Commit-Lint** configurations.
<br>

## Getting Started
### 1. Quick Start
To use this starter template, you can either clone this repository or use this template as the base of your project.
```bash
# Clone this repository
$ git clone https://github.com/AidenLeeeee/nestjs-prisma-postgres.git

# Navigate to the project directory
$ cd nestjs-prisma-postgres

# Install dependencies
$ pnpm install

# Start the development server
$ pnpm run start:dev
```

<br>

### 2. PostgreSQL with Docker
To utilize Docker to launch PostgreSQL in your local environment, please refer to the following instructions.

#### 1) Please fill out the `.env` file as shown below.
```bash
# Environment file template

# 🚨 Do not upload this file to GitHub.
# 🚨 Make sure you have added this file to the .gitignore file.

# App
NODE_ENV=

# DB
POSTGRES_DB=myDb                                      # Whatever you want.
POSTGRES_USER=myUser                                  # Whatever you want.
POSTGRES_PASSWORD=myPassword                          # Whatever you want.
POSTGRES_HOME_DIR=/my/local/path/data/                # Your Local path to be linked with the docker volume.
POSTGRES_PORT=5432                                    # Whatever you want.
POSTGRES_URL=`postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public`
```
<br>

#### 2) Navigate to `.gitignore` and uncomment the .env glob at the bottom of the file.
```bash
# Env files
# 🚨 Be sure to uncomment the comments below. (# .env -> .env)
.env
```
<br>

#### 3) Run the command below to execute the `docker-compose.db.yml` file and quickly launch PostgreSQL locally.
```bash
$ docker compose -f docker-compose.db.yml up -d
# or
$ npm run docker:db
```

<br>

## Caution
#### ⚠️ Security
Be careful not to upload your created env file to GitHub.<br>
Don't forget to uncomment the .env glob in the `.gitignore` file to prevent the env file from being uploaded to GitHub.
```bash
# Env files
# 🚨 Be sure to uncomment the comments below. (# .env -> .env)
.env
```
<br>

#### ⚠️ Commit Lint Convention
This template comes with automatic commit linting, and please refer to the related links below for more information.<br>
[@commitlint/config-conventional](https://github.com/conventional-changelog/commitlint)


**[⬆ back to top](#instruction)**
