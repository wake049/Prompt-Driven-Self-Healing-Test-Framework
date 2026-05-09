import asyncio, asyncpg

async def clean():
    conn = await asyncpg.connect(
        host='prompt-qa.choawqiq4n3x.us-east-2.rds.amazonaws.com',
        port=5432, database='promptqa',
        user='prompt_qa_db', password='St70698!2#4'
    )
    # Find all pages with element_N style names
    rows = await conn.fetch(
        "SELECT page_id, count(*) as cnt FROM repo.elements "
        "WHERE name LIKE 'element_%' OR length(primary_selector::text) > 200 "
        "GROUP BY page_id"
    )
    print(f'Pages with bad elements: {len(rows)}')
    for r in rows:
        print(f'  page_id={r["page_id"]}  count={r["cnt"]}')

    total = await conn.fetchval('SELECT count(*) FROM repo.elements')
    print(f'\nTotal elements across all pages: {total}')

    bad = await conn.fetchval(
        "SELECT count(*) FROM repo.elements "
        "WHERE name LIKE 'element_%' OR length(primary_selector::text) > 200 "
        "OR primary_selector::text LIKE '%Action menu for%' "
        "OR primary_selector::text LIKE '%Go to channel%' "
        "OR primary_selector::text LIKE '%play Short%' "
        "OR primary_selector::text LIKE '%play video%'")
    print(f'Bad elements to delete: {bad}')

    if bad > 0:
        deleted = await conn.execute(
            "DELETE FROM repo.elements "
            "WHERE name LIKE 'element_%' OR length(primary_selector::text) > 200 "
            "OR primary_selector::text LIKE '%Action menu for%' "
            "OR primary_selector::text LIKE '%Go to channel%' "
            "OR primary_selector::text LIKE '%play Short%' "
            "OR primary_selector::text LIKE '%play video%'")
        print(f'Deleted: {deleted}')

    remaining = await conn.fetchval('SELECT count(*) FROM repo.elements')
    print(f'Remaining: {remaining}')
    await conn.close()

asyncio.run(clean())
