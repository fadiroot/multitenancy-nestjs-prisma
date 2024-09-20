CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    permission_name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT
);

-- Example of adding default permissions
INSERT INTO permissions (permission_name, description) VALUES
('read', 'Read access'),
('write', 'Write access'),
('delete', 'Delete access');
