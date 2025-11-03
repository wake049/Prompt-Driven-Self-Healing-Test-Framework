import asyncio
import sys
import os
sys.path.append(os.getcwd())

async def migrate_existing_prompts():
    print('🔄 Migrating existing prompts to dual selector format...')
    try:
        from core.database import get_database
        db = await get_database()
        
        # Find steps with selectors in parameters but no dual selectors
        migration_query = """
        UPDATE tests.test_steps 
        SET 
            css_selector = CASE 
                WHEN parameters->>'selector' NOT LIKE '//%' 
                AND parameters->>'selector' NOT LIKE '%[@%' 
                THEN parameters->>'selector'
                ELSE NULL
            END,
            xpath_selector = CASE 
                WHEN parameters->>'selector' LIKE '//%' 
                OR parameters->>'selector' LIKE '%[@%' 
                THEN parameters->>'selector'
                ELSE NULL
            END,
            selector_metadata = jsonb_build_object(
                'migration_date', NOW(),
                'original_selector', parameters->>'selector',
                'migration_source', 'automatic_migration'
            )
        WHERE parameters->>'selector' IS NOT NULL 
        AND css_selector IS NULL 
        AND xpath_selector IS NULL
        """
        
        await db.execute(migration_query)
        print('✅ Migration executed')
        
        # Check results
        check_query = """
        SELECT 
            COUNT(*) as total_steps,
            COUNT(css_selector) as css_count,
            COUNT(xpath_selector) as xpath_count,
            COUNT(CASE WHEN css_selector IS NOT NULL AND xpath_selector IS NOT NULL THEN 1 END) as dual_count
        FROM tests.test_steps
        """
        
        stats = await db.execute_one(check_query)
        if stats:
            total = stats.get("total_steps", 0)
            css = stats.get("css_count", 0)
            xpath = stats.get("xpath_count", 0)
            dual = stats.get("dual_count", 0)
            
            print(f'📊 Migration Results:')
            print(f'  Total steps: {total}')
            print(f'  Steps with CSS selectors: {css}')
            print(f'  Steps with XPath selectors: {xpath}')
            print(f'  Steps with dual selectors: {dual}')
        
        print('✅ Migration completed successfully!')
        
    except Exception as e:
        print(f'❌ Migration failed: {e}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(migrate_existing_prompts())