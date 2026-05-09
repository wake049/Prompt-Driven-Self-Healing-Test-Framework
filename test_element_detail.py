import httpx, json

TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0MkB0ZXN0LmNvbSIsInVzZXJfaWQiOiI2MWFhNDY2Ny1jODg0LTQ1NGQtOGJkZC0zOThlNDgwZWE1MWYiLCJ0ZW5hbnRfaWQiOiI5ZDYxZWMzZS1jNGI4LTQzZDQtOTcwNS1iMmQ4OWFjN2U5ZDAiLCJwcm9qZWN0X2lkIjoiYmZhZWI4ZDMtNmM0OS00NzM3LThlMTktMGUyOTNjYWViYmYwIiwiZXhwIjoxNzc2NTg5ODY1LCJpYXQiOjE3NzY1NjEwNjV9.LPmEWT_RZSpRJ2tyxLBK5y_iLTN1bnB2Odu6QjPW6BU'
HEADERS = {'Authorization': f'Bearer {TOKEN}'}

r = httpx.get('http://localhost:8000/api/v1/sql/elements?limit=3&platform=android', headers=HEADERS, timeout=10)
for e in r.json()['data'][:3]:
    key = e['logical_key']
    print(f"=== {key} ===")
    print(f"  tag: {e['tag']}")
    print(f"  css: {e['css_selector'][:100]}")
    xpath = e.get('xpath', '')
    print(f"  xpath: {xpath[:100] if xpath else 'none'}")
    attrs = e.get('attributes', {})
    rid = attrs.get('resource-id', attrs.get('resourceId', 'none'))
    cdesc = attrs.get('content-desc', attrs.get('contentDescription', 'none'))
    print(f"  resource-id: {rid}")
    print(f"  content-desc: {cdesc}")
    print(f"  text: {e.get('text_content', '')[:60]}")
    print()
