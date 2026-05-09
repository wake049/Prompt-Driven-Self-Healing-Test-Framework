import httpx

TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0MkB0ZXN0LmNvbSIsInVzZXJfaWQiOiI2MWFhNDY2Ny1jODg0LTQ1NGQtOGJkZC0zOThlNDgwZWE1MWYiLCJ0ZW5hbnRfaWQiOiI5ZDYxZWMzZS1jNGI4LTQzZDQtOTcwNS1iMmQ4OWFjN2U5ZDAiLCJwcm9qZWN0X2lkIjoiYmZhZWI4ZDMtNmM0OS00NzM3LThlMTktMGUyOTNjYWViYmYwIiwiZXhwIjoxNzc2NTg5ODY1LCJpYXQiOjE3NzY1NjEwNjV9.LPmEWT_RZSpRJ2tyxLBK5y_iLTN1bnB2Odu6QjPW6BU'
HEADERS = {'Authorization': f'Bearer {TOKEN}'}

# Test 1: platform=android filter
print("=== Test: elements?platform=android ===")
r = httpx.get('http://localhost:8000/api/v1/sql/elements?limit=5&platform=android', headers=HEADERS, timeout=10)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    data = r.json()
    print(f"Count: {data.get('count', 0)}")
    for e in data.get('data', [])[:5]:
        attrs = e.get('attributes', {})
        rid = attrs.get('resource-id', attrs.get('resourceId', ''))
        print(f"  - {e['logical_key']}: rid={rid[:60]}")
else:
    print(f"Error: {r.text[:300]}")

# Test 2: all elements (no filter)
print("\n=== Test: elements (no platform filter) ===")
r2 = httpx.get('http://localhost:8000/api/v1/sql/elements?limit=5', headers=HEADERS, timeout=10)
print(f"Status: {r2.status_code}, Count: {r2.json().get('count', 0) if r2.status_code == 200 else 'N/A'}")
