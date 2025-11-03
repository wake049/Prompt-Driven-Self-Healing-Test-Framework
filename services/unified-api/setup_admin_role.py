"""
Setup Admin Role
Creates the 'Admin' role in the database if it doesn't exist.
This script ensures the safety policy can properly identify admin users.
"""

import asyncio
import logging
from core.database import get_database_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def setup_admin_role():
    """Create Admin role if it doesn't exist"""
    try:
        db = await get_database_manager()
        
        # Check if Admin role exists
        existing_role = await db.execute_one(
            """
            SELECT id, name FROM core.roles WHERE name = 'Admin' LIMIT 1
            """
        )
        
        if existing_role:
            logger.info(f"✅ Admin role already exists: {existing_role['id']}")
            return existing_role['id']
        
        # Create Admin role
        admin_role = await db.execute_one(
            """
            INSERT INTO core.roles (id, name, description, created_at, updated_at)
            VALUES (gen_random_uuid(), 'Admin', 'Administrator role with full permissions', NOW(), NOW())
            RETURNING id, name
            """
        )
        
        logger.info(f"✅ Created Admin role: {admin_role['id']}")
        return admin_role['id']
        
    except Exception as e:
        logger.error(f"❌ Failed to setup admin role: {e}")
        raise


async def assign_admin_role_to_user(user_email: str):
    """Assign admin role to a specific user"""
    try:
        db = await get_database_manager()
        
        # Get user ID
        user = await db.execute_one(
            """
            SELECT id, email FROM core.users WHERE email = $1
            """,
            user_email
        )
        
        if not user:
            logger.error(f"❌ User not found: {user_email}")
            return False
        
        # Get Admin role ID
        admin_role = await db.execute_one(
            """
            SELECT id FROM core.roles WHERE name = 'Admin' LIMIT 1
            """
        )
        
        if not admin_role:
            logger.error("❌ Admin role not found. Run setup_admin_role() first.")
            return False
        
        # Get user's first tenant (for role assignment)
        user_tenant = await db.execute_one(
            """
            SELECT tenant_id FROM core.user_tenant_roles 
            WHERE user_id = $1 
            LIMIT 1
            """,
            str(user['id'])
        )
        
        if not user_tenant:
            logger.error(f"❌ No tenant found for user: {user_email}")
            return False
        
        # Check if user already has admin role
        existing_admin = await db.execute_one(
            """
            SELECT id FROM core.user_tenant_roles 
            WHERE user_id = $1 AND tenant_id = $2 AND role_id = $3
            """,
            str(user['id']), user_tenant['tenant_id'], str(admin_role['id'])
        )
        
        if existing_admin:
            logger.info(f"✅ User {user_email} already has Admin role")
            return True
        
        # Assign admin role
        await db.execute_one(
            """
            INSERT INTO core.user_tenant_roles (id, user_id, tenant_id, role_id, created_at, updated_at)
            VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
            """,
            str(user['id']), user_tenant['tenant_id'], str(admin_role['id'])
        )
        
        logger.info(f"✅ Assigned Admin role to user: {user_email}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to assign admin role to {user_email}: {e}")
        return False


async def list_admin_users():
    """List all users with admin roles"""
    try:
        db = await get_database_manager()
        
        admin_users = await db.execute(
            """
            SELECT u.email, u.full_name, t.name as tenant_name
            FROM core.users u
            JOIN core.user_tenant_roles utr ON u.id = utr.user_id
            JOIN core.roles r ON utr.role_id = r.id
            JOIN core.tenants t ON utr.tenant_id = t.id
            WHERE r.name = 'Admin' AND u.is_active = true
            ORDER BY u.email
            """
        )
        
        if admin_users:
            logger.info("👑 Admin Users:")
            for admin in admin_users:
                logger.info(f"  - {admin['email']} ({admin['full_name']}) in tenant: {admin['tenant_name']}")
        else:
            logger.info("ℹ️ No admin users found")
        
        return admin_users
        
    except Exception as e:
        logger.error(f"❌ Failed to list admin users: {e}")
        return []


async def main():
    """Setup admin role and optionally assign to a user"""
    try:
        # Setup admin role
        await setup_admin_role()
        
        # List current admin users
        await list_admin_users()
        
        # Example: Uncomment to assign admin role to a specific user
        # await assign_admin_role_to_user("admin@example.com")
        
        logger.info("🎯 Admin role setup complete!")
        logger.info("💡 Use assign_admin_role_to_user('email@domain.com') to make users admin")
        
    except Exception as e:
        logger.error(f"❌ Setup failed: {e}")


if __name__ == "__main__":
    asyncio.run(main())