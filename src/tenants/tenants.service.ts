import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTenantDto } from './dto/create-user.dto';
import { Tenant } from '@prisma/client';
import { Client } from 'pg';
import Docker = require('dockerode');

@Injectable()
export class TenantService {
    private readonly docker: Docker;
    constructor(private prisma: PrismaService) {
        this.docker = new Docker();
    }

    async getTenantByDomain(domain: string): Promise<Tenant | null> {
        return this.prisma.tenant.findUnique({
            where: { domain },
        });
    }
    async createPostgresContainer(tenantName: string): Promise<string> {
        // Generate a unique name for the container (e.g., tenant-specific)
        const containerName = `postgres-${tenantName}`;

        // Pull the PostgreSQL image (optional, if not available locally)
        await this.docker.pull('postgres:latest', {});

        // Create the PostgreSQL container with environment variables for user, password, and database
        const container = await this.docker.createContainer({
            Image: 'postgres:latest',
            name: containerName,
            Env: [
                'POSTGRES_USER=tenant_user', // Customize the user for each tenant
                'POSTGRES_PASSWORD=tenant_pass', // Customize the password for each tenant
                'POSTGRES_DB=tenant_db', // Customize the database name for each tenant
            ],
            HostConfig: {
                PortBindings: {
                    '5432/tcp': [{ HostPort: this.getAvailablePort() }], // Expose the container port to an available host port
                },
            },
        });

        // Start the container
        await container.start();

        return `PostgreSQL container created for tenant ${tenantName} with ID: ${container.id}`;
    }

    private getAvailablePort(): string {
        // You can implement logic to find an available port dynamically or assign a fixed port range per tenant
        // For simplicity, we'll use a fixed port (for a more complex approach, consider port management tools)
        return '5432'; // Replace with logic to assign different ports per container
    }

    async createTenant(createTenantDto: CreateTenantDto): Promise<Tenant> {
        const { name, domain } = createTenantDto;
        const dbName = `tenant_${name.toLowerCase().replace(/\s/g, '_')}`;
        const dbUser = `user_${name.toLowerCase().replace(/\s/g, '_')}`;
        const dbPassword = this.generateSecurePassword();

        const existingTenant = await this.prisma.tenant.findUnique({
            where: { domain },
        });

        if (existingTenant) {
            throw new Error('A tenant with this domain already exists');
        }
        const conatiner = await this.createPostgresContainer(dbName);
        console.log('yes the conatiner created with sucess ', conatiner);

        const tenant = await this.prisma.tenant.create({
            data: {
                name,
                domain,
                dbName,
                dbUser,
                dbPassword,
            },
        });

        await this.createTenantDatabase(dbName, dbUser, dbPassword);

        return tenant;
    }

    private generateSecurePassword(): string {
        // Implement secure password generation
        return 'securePassword123!'; // Placeholder password
    }

    private async createTenantDatabase(
        dbName: string,
        dbUser: string,
        dbPassword: string,
    ) {
        const adminClient = new Client({
            user: 'myUser',
            host: 'db',
            database: 'postgres',
            password: 'myPassword',
            port: 5432,
        });

        try {
            await adminClient.connect();

            // Create database
            await adminClient.query(`CREATE DATABASE "${dbName}"`);
            console.log(`Database ${dbName} created`);

            // Create user
            await adminClient.query(
                `CREATE USER "${dbUser}" WITH ENCRYPTED PASSWORD '${dbPassword}'`,
            );
            console.log(`User ${dbUser} created`);

            // Grant connect privilege on the new database
            await adminClient.query(
                `GRANT CONNECT ON DATABASE "${dbName}" TO "${dbUser}"`,
            );
            console.log(`Connect privilege granted to ${dbUser} on ${dbName}`);

            // Close the admin connection to postgres database
            await adminClient.end();

            // Connect to the new database to set up schema and permissions
            const newDbClient = new Client({
                user: 'myUser',
                host: 'db',
                database: dbName,
                password: 'myPassword',
                port: 5432,
            });

            await newDbClient.connect();
            // Grant usage and create privileges on schema public
            await newDbClient.query(
                `GRANT USAGE, CREATE ON SCHEMA public TO "${dbUser}"`,
            );
            console.log(`Schema privileges granted to ${dbUser}`);

            // Grant all privileges on all tables in schema public
            await newDbClient.query(
                `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "${dbUser}"`,
            );
            console.log(`Table privileges granted to ${dbUser}`);

            // Close the admin connection to the new database
            await newDbClient.end();

            // Connect to the new tenant database as the new user
            const tenantClient = new Client({
                user: dbUser,
                host: 'db',
                database: dbName,
                password: dbPassword,
                port: 5432,
            });

            try {
                await tenantClient.connect();
                console.log(`Connected to tenant database ${dbName}`);

                // Create tables
                await tenantClient.query(`
                    CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        email VARCHAR(255) UNIQUE NOT NULL,
                        name VARCHAR(255),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                console.log('Users table created');

                await tenantClient.query(`
                    CREATE TABLE IF NOT EXISTS roles (
                        id SERIAL PRIMARY KEY,
                        role_name VARCHAR(255) UNIQUE NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                console.log('Roles table created');

                // Insert a default user
                const defaultUserEmail = 'admin@example.com';
                const defaultUserName = 'Admin User';
                await tenantClient.query(
                    `
                    INSERT INTO users (email, name) 
                    VALUES ($1, $2) 
                    ON CONFLICT (email) DO NOTHING
                `,
                    [defaultUserEmail, defaultUserName],
                );
                console.log('Default user created');
            } catch (tableError) {
                console.error(
                    'Error creating tables or default user:',
                    tableError,
                );
                throw new Error('Error setting up tenant database');
            } finally {
                await tenantClient.end();
            }

            console.log(
                `Database ${dbName} created with tables and default user for ${dbUser}`,
            );
        } catch (error) {
            console.error('Error in createTenantDatabase:', error);
            throw new Error('Error creating tenant database');
        }
    }
}
