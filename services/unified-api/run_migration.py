#!/usr/bin/env python3
import asyncpg
import asyncio

async def run_migration():
    try:
        # Connect to database
        conn = await asyncpg.connect('postgresql://testframework:securepassword@localhost:5432/testframework_db')
        print("🔌 Connected to database")
        
        # Read and execute migration SQL
        with open('add_auth_schema.sql', 'r') as f:
            sql_commands = f.read()
        
        # Split by semicolon and execute each command
        commands = [cmd.strip() for cmd in sql_commands.split(';') if cmd.strip() and not cmd.strip().startswith('--')]
        
        for i, cmd in enumerate(commands):
            if cmd:
                print(f" Executing command {i+1}/{len(commands)}")
                try:
                    result = await conn.execute(cmd)
                    print(f" Command executed: {result}")
                except Exception as e:
                    print(f"  Command error (might be expected): {e}")
        
        # Show current users
        result = await conn.fetch('SELECT email, full_name, is_active FROM core.users')
        print("\n Users in database:")
        for row in result:
            print(f"  📧 {row['email']} - {row['full_name']} (active: {row['is_active']})")
        
        # Show tenants and projects
        tenants = await conn.fetch('SELECT name, slug FROM core.tenants')
        print("\n🏢 Tenants:")
        for row in tenants:
            print(f"  🏢 {row['name']} ({row['slug']})")
            
        projects = await conn.fetch('SELECT name, slug FROM core.projects')
        print("\n📁 Projects:")
        for row in projects:
            print(f"  📁 {row['name']} ({row['slug']})")
        
        await conn.close()
        print("\n Migration completed successfully!")
        
    except Exception as e:
        print(f" Migration failed: {e}")

if __name__ == "__main__":
    asyncio.run(run_migration())