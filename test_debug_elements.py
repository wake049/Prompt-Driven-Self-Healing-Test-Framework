import httpx

TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0MkB0ZXN0LmNvbSIsInVzZXJfaWQiOiI2MWFhNDY2Ny1jODg0LTQ1NGQtOGJkZC0zOThlNDgwZWE1MWYiLCJ0ZW5hbnRfaWQiOiI5ZDYxZWMzZS1jNGI4LTQzZDQtOTcwNS1iMmQ4OWFjN2U5ZDAiLCJwcm9qZWN0X2lkIjoiYmZhZWI4ZDMtNmM0OS00NzM3LThlMTktMGUyOTNjYWViYmYwIiwiZXhwIjoxNzc2NTg5ODY1LCJpYXQiOjE3NzY1NjEwNjV9.LPmEWT_RZSpRJ2tyxLBK5y_iLTN1bnB2Odu6QjPW6BU'
H = {'Authorization': f'Bearer {TOKEN}'}

# All elements
r1 = httpx.get('http://localhost:8000/api/v1/sql/elements?limit=1000', headers=H, timeout=10)
all_data = r1.json()
print(f"=== ALL elements: {all_data['count']} ===")
# Show tag distribution
tags = {}
for e in all_data['data']:
    t = e['tag']
    tags[t] = tags.get(t, 0) + 1
print(f"  Tags: {tags}")

# Android only
r2 = httpx.get('http://localhost:8000/api/v1/sql/elements?limit=1000&platform=android', headers=H, timeout=10)
android_data = r2.json()
print(f"\n=== ANDROID elements: {android_data['count']} ===")
tags2 = {}
for e in android_data['data']:
    t = e['tag']
    tags2[t] = tags2.get(t, 0) + 1
print(f"  Tags: {tags2}")

# Show a few android elements
for e in android_data['data'][:5]:
    print(f"  - {e['logical_key']}: tag={e['tag']}, xpath={e.get('xpath','')[:60]}")
