import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { databaseConfig } from '../config/database.config';
import { execSync } from 'child_process';
import * as path from 'path';

@Injectable()
export class DynamicPrismaClientFactory implements OnModuleDestroy {
    private clients: Map<string, PrismaClient> = new Map();
    private masterClient: PrismaClient | undefined;

    // Analysis:
    // 1. Purpose: This class manages Prisma clients for multiple tenants in a multi-tenant application.
    // 2. Key components:
    //    - clients: A Map to store PrismaClient instances for each tenant
    //    - masterClient: A PrismaClient instance for the master database
    
    // Method: getClientForTenant
    // Purpose: Retrieves or creates a PrismaClient for a specific tenant
    // Analysis:
    // - Checks if a client already exists for the tenant
    // - If not, creates a new PrismaClient with tenant-specific connection details
    // - Stores the new client in the clients Map
    // - Returns the client for the tenant
    async getClientForTenant(tenant: any): Promise<PrismaClient> {
        const existingClient = this.clients.get(tenant.dbName);
        console.log(this.clients)

        if (existingClient) {
            return existingClient;
        }

        const client = new PrismaClient({
            datasources: {
                db: {
                    url: `postgresql://${tenant.dbUser}:${tenant.dbPassword}@host.docker.internal:${tenant.dbPort}/${tenant.dbName}?schema=public`,
                },
            },
        });

        this.clients.set(tenant.dbName, client);
        return client;
    }

    // Method: getMasterClient
    // Purpose: Retrieves or creates the master PrismaClient
    // Analysis:
    // - Lazy initialization of the master client
    // - Uses the master database configuration from databaseConfig
    getMasterClient(): PrismaClient {
        if (!this.masterClient) {
            this.masterClient = new PrismaClient({
                datasources: {
                    db: {
                        url: databaseConfig.master.url,
                    },
                },
            });
        }
        return this.masterClient;
    }

    // Method: createTenantDatabase
    // Purpose: Creates a new database and user for a tenant
    // Analysis:
    // - Uses the master client to execute raw SQL commands
    // - Creates a new database for the tenant
    // - Creates a new user and grants privileges
    // - Applies migrations to the new tenant database
    async createTenantDatabase(tenantInfo: {
        dbName: string;
        dbUser: string;
        dbPassword: string;
    }): Promise<void> {
        const masterClient = this.getMasterClient();

        // Create the database
        await masterClient.$executeRawUnsafe(
            `CREATE DATABASE "${tenantInfo.dbName}"`,
        );

        // Create the user and grant privileges
        await masterClient.$executeRawUnsafe(
            `CREATE USER "${tenantInfo.dbUser}" WITH PASSWORD '${tenantInfo.dbPassword}'`,
        );
        await masterClient.$executeRawUnsafe(
            `GRANT ALL PRIVILEGES ON DATABASE "${tenantInfo.dbName}" TO "${tenantInfo.dbUser}"`,
        );

        // Apply migrations to the new database
        await this.applyMigrationsToTenant(tenantInfo);
    }

    // Method: applyMigrationsToTenant
    // Purpose: Applies Prisma migrations to a tenant's database
    // Analysis:
    // - Constructs the database URL for the tenant
    // - Temporarily sets the DATABASE_URL environment variable
    // - Executes Prisma CLI commands to apply migrations
    // - Resets the DATABASE_URL to the master database
    async applyMigrationsToTenant(tenantInfo: {
        dbName: string;
        dbUser: string;
        dbPassword: string;
    }): Promise<void> {
        const tenantDatabaseUrl = `postgresql://${tenantInfo.dbUser}:${tenantInfo.dbPassword}@${databaseConfig.tenant.host}:${databaseConfig.tenant.port}/${tenantInfo.dbName}?schema=public`;

        // Set the DATABASE_URL environment variable for Prisma CLI
        process.env.DATABASE_URL = tenantDatabaseUrl;

        // Run Prisma migrations
        const prismaPath = path.join(
            __dirname,
            '..',
            '..',
            'node_modules',
            '.bin',
            'prisma',
        );
        execSync(`${prismaPath} migrate deploy`, { stdio: 'inherit' });

        // Optionally, run seeds if you have any
        // execSync(`${prismaPath} db seed`, { stdio: 'inherit' });

        // Reset the DATABASE_URL
        process.env.DATABASE_URL = databaseConfig.master.url;
    }

    // Method: getUsersForTenant
    // Purpose: Retrieves users for a specific tenant
    // Analysis:
    // - Gets the PrismaClient for the tenant
    // - Executes a raw SQL query to fetch users
    // - Returns the list of users
    // Note: This method uses console.log for debugging, which should be replaced with proper logging in production
    async getUsersForTenant(tenant: any): Promise<any[]> {
        console.log('Tenant info:', tenant);
        const client = await this.getClientForTenant(tenant);
        console.log('Got client for tenant:', tenant.dbName);
        const users = await client.$queryRaw`SELECT * FROM "User"`;
        console.log('Retrieved users:', users);
        return users as any[];
    }

    async onModuleDestroy() {
        // Disconnect all clients when the module is destroyed
        for (const client of this.clients.values()) {
            await client.$disconnect();
        }
        if (this.masterClient) {
            await this.masterClient.$disconnect();
        }
    }

    async disconnectClient(tenantDbName: string) {
        const client = this.clients.get(tenantDbName);
        if (client) {
            await client.$disconnect();
            this.clients.delete(tenantDbName);
        }
    }
}

// Overall Analysis:
// 1. This class implements a dynamic multi-tenant database management system using Prisma.
// 2. It supports creating new tenant databases, applying migrations, and executing queries for specific tenants.
// 3. The design allows for efficient management of multiple database connections in a multi-tenant environment.
// 4. There's room for improvement in error handling, logging, and type safety (e.g., using more specific types instead of 'any').
// 5. The class relies on external configuration (databaseConfig) and assumes a certain directory structure for Prisma CLI.
// 6. The use of execSync for running Prisma commands could potentially be replaced with a more robust solution.
// 7. The class doesn't handle connection pooling or client disposal, which might be necessary for optimal performance and resource management.
