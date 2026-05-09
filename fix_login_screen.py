import asyncio, asyncpg

async def main():
    conn = await asyncpg.connect(
        host='prompt-qa.choawqiq4n3x.us-east-2.rds.amazonaws.com',
        port=5432, user='prompt_qa_db', password='St70698!2#4', database='promptqa'
    )

    # Check Login Screen page
    r = await conn.fetchrow("SELECT id, project_id, name FROM repo.pages WHERE name='Login Screen'")
    print('Login Screen page:', dict(r) if r else 'NOT FOUND')

    if r:
        cnt = await conn.fetchval('SELECT COUNT(*) FROM repo.elements WHERE page_id=$1', r['id'])
        print(f'Elements on Login Screen: {cnt}')
        print(f'Current project_id: {r["project_id"]}')

        # Fix the project_id
        await conn.execute(
            "UPDATE repo.pages SET project_id='bfaeb8d3-6c49-4737-8e19-0e293caebbf0' WHERE id=$1",
            r['id']
        )
        print('Fixed project_id -> bfaeb8d3-6c49-4737-8e19-0e293caebbf0')

    # Now check total elements visible to the user's project
    total = await conn.fetchval(
        "SELECT COUNT(*) FROM repo.elements e JOIN repo.pages p ON e.page_id=p.id WHERE p.project_id='bfaeb8d3-6c49-4737-8e19-0e293caebbf0'"
    )
    print(f'\nTotal elements now visible to user project: {total}')

    # Breakdown by page
    rows = await conn.fetch(
        "SELECT p.name, COUNT(e.id) as cnt FROM repo.elements e JOIN repo.pages p ON e.page_id=p.id WHERE p.project_id='bfaeb8d3-6c49-4737-8e19-0e293caebbf0' GROUP BY p.name ORDER BY cnt DESC"
    )
    for row in rows:
        print(f'  {row["name"]}: {row["cnt"]} elements')

    await conn.close()

asyncio.run(main())
