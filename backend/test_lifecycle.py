"""Inventory lifecycle E2E tests (Tests A-L) against the live server.
Covers registration, partial/full sale, disposal, archive, role permissions,
analytics impact, and history preservation. Deletes only its own test data.
"""
import json
import time
import urllib.request
import urllib.error
from pathlib import Path

BASE = 'http://localhost:8000'
RESULTS = []


def call(method, path, body=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, method=method, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode()
            return r.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw[:200]


def check(name, condition, detail=''):
    RESULTS.append((name, bool(condition), detail))
    print(f"{'PASS' if condition else 'FAIL'}  {name}" + (f"  -> {detail}" if detail else ''))


S = str(int(time.time()))
USERS = {
    'admin': (f'lc_admin_{S}', 'Administrator'),
    'consumer': (f'lc_cons_{S}', 'Consumer'),
    'retail': (f'lc_retail_{S}', 'Retail Manager'),
    'warehouse': (f'lc_ware_{S}', 'Warehouse Operator'),
    'inspector': (f'lc_insp_{S}', 'Food Quality Inspector'),
    'consumer2': (f'lc_cons2_{S}', 'Consumer'),
}
T = {}
for key, (uname, role) in USERS.items():
    code, r = call('POST', '/api/auth/signup',
                   {'username': uname, 'email': f'{uname}@t.com', 'password': 'testpass1', 'role': role})
    assert code == 200, f'signup {key}: {code} {r}'
    T[key] = r['access_token']
print(f'{len(T)} users created\n')

print("=== A. REGISTER PRODUCT ===")
code, item = call('POST', '/api/inventory/', {
    'name': 'Lifecycle Apple', 'category': 'Fruits', 'quantity': 20, 'batch_number': f'LC-{S}',
    'storage_zone': 'Cold Storage 1', 'temperature_c': 4.0, 'humidity_pct': 90.0,
    'packaging_type': 'Ventilated', 'stored_at': '2026-09-25T10:00:00Z', 'expiry_date': None,
}, token=T['retail'])
check('A1: registration returns Active item with lifecycle fields',
      code == 200 and item['status'] == 'Active' and item['active_quantity'] == 20
      and item['sold_quantity'] == 0 and item['disposed_quantity'] == 0)
ITEM = item['_id']
code, detail = call('GET', f'/api/inventory/{ITEM}', token=T['retail'])
check('A2: registered event logged', any(e['event_type'] == 'registered' and e['quantity_delta'] == 20
                                         for e in detail.get('lifecycle_events', [])))

print("\n=== B. PARTIAL SALE (8 of 20) ===")
code, r = call('POST', f'/api/inventory/{ITEM}/sell',
               {'quantity_sold': 8, 'notes': 'morning rush'}, token=T['retail'])
check('B1: partial sale -> quantity 12, still Active',
      code == 200 and r['active_quantity'] == 12 and r['status'] == 'Active' and r['sold_quantity'] == 8)
code, detail = call('GET', f'/api/inventory/{ITEM}', token=T['retail'])
sold_events = [e for e in detail['lifecycle_events'] if e['event_type'] == 'sold']
check('B2: sold event logged with actor', len(sold_events) == 1
      and sold_events[0]['performed_by_role'] == 'Retail Manager'
      and sold_events[0]['quantity_delta'] == -8)

print("\n=== C. COMPLETE SALE -> SOLD OUT ===")
code, r = call('POST', f'/api/inventory/{ITEM}/sell', {'quantity_sold': 12}, token=T['retail'])
check('C1: full sale -> status Sold Out, quantity 0',
      code == 200 and r['status'] == 'Sold Out' and r['active_quantity'] == 0
      and r['sold_quantity'] == 20 and r['sold_by'] == USERS['retail'][0])
code, r2 = call('POST', f'/api/inventory/{ITEM}/sell', {'quantity_sold': 1}, token=T['retail'])
check('C2: cannot sell a Sold Out item (409)', code == 409, f'HTTP {code}')

print("\n=== D. ACTIVE INVENTORY COUNTS EXCLUDE SOLD OUT ===")
code, active_list = call('GET', '/api/inventory/?lifecycle=active', token=T['retail'])
check('D1: sold-out item excluded from active inventory',
      all(i['_id'] != ITEM for i in active_list))
code, archived_list = call('GET', '/api/inventory/?lifecycle=archived_view', token=T['retail'])
check('D2: sold-out item appears in archive view',
      any(i['_id'] == ITEM and i['status'] == 'Sold Out' for i in archived_list))
code, overview = call('GET', '/api/recommendations/inventory-overview', token=T['retail'])
check('D3: sold-out item excluded from inventory insights',
      all(e.get('item_id') != ITEM for e in overview.get('items', [])))
code, fresh = call('GET', '/api/analytics/freshness', token=T['retail'])
check('D4: sold-out item excluded from freshness analytics',
      all(i['_id'] != ITEM for i in fresh.get('items', [])))

print("\n=== E/F. HISTORY PRESERVED AFTER LIFECYCLE CHANGE ===")
code, preds = call('GET', f'/api/shelf-life/history?item_id={ITEM}', token=T['retail'])
check('F1: shelf-life prediction history still queryable', code == 200 and isinstance(preds, list))
code, detail = call('GET', f'/api/inventory/{ITEM}', token=T['retail'])
check('E1: item record (with quantities sold) still exists after Sold Out',
      code == 200 and detail['status'] == 'Sold Out' and detail['sold_quantity'] == 20)
code, events = call('GET', f'/api/inventory/{ITEM}/history', token=T['retail'])
check('E2: full lifecycle event trail available',
      code == 200 and [e['event_type'] for e in events['events']].count('sold') == 2)

print("\n=== G. WAREHOUSE DISPOSAL FLOW ===")
code, w_item = call('POST', '/api/inventory/', {
    'name': 'Lifecycle Yogurt', 'category': 'Dairy Products', 'quantity': 10,
    'batch_number': f'LCY-{S}', 'storage_zone': 'Cold Storage 2',
    'packaging_type': 'Sealed Container', 'stored_at': '2026-09-27T08:00:00Z',
}, token=T['warehouse'])
WID = w_item['_id']
code, r = call('POST', f'/api/inventory/{WID}/dispose',
               {'quantity_disposed': 4, 'reason': 'damaged', 'notes': 'crate dropped'}, token=T['warehouse'])
check('G1: partial disposal -> 6 active, disposed_quantity 4, still Active',
      code == 200 and r['active_quantity'] == 6 and r['disposed_quantity'] == 4 and r['status'] == 'Active')
code, r = call('POST', f'/api/inventory/{WID}/dispose', {'quantity_disposed': 6, 'reason': 'spoiled'},
               token=T['warehouse'])
check('G2: full disposal -> status Disposed',
      code == 200 and r['status'] == 'Disposed' and r['disposed_by'] == USERS['warehouse'][0])
code, r = call('POST', f'/api/inventory/{WID}/adjust', {'new_quantity': 99, 'reason': 'count fix'},
               token=T['warehouse'])
check('G3: cannot adjust a Disposed item (409)', code == 409, f'HTTP {code}')
code, expired_item = call('POST', '/api/inventory/', {
    'name': 'Lifecycle Bread', 'category': 'Bakery Products', 'quantity': 3,
    'batch_number': f'LCB-{S}', 'packaging_type': 'Open', 'stored_at': '2026-09-20T08:00:00Z',
}, token=T['warehouse'])
code, r = call('POST', f"/api/inventory/{expired_item['_id']}/mark-expired", token=T['warehouse'])
check('G4: mark-expired -> status Expired, units leave active stock',
      code == 200 and r['status'] == 'Expired' and r['active_quantity'] == 0
      and r['disposed_quantity'] == 3)

print("\n=== H. CONSUMER OWNERSHIP ===")
code, c_item = call('POST', '/api/inventory/', {
    'name': 'My Home Milk', 'category': 'Dairy Products', 'quantity': 2,
    'batch_number': f'LCC-{S}', 'storage_zone': 'Home Fridge', 'packaging_type': 'Sealed Container',
    'stored_at': '2026-09-28T18:00:00Z',
}, token=T['consumer'])
CID = c_item['_id']
code, r = call('POST', f'/api/inventory/{CID}/archive', {'reason': 'used it up'}, token=T['consumer'])
check('H1: consumer archives own item ("Remove from My Food")',
      code == 200 and r['status'] == 'Archived' and r['archived_by'] == USERS['consumer'][0])
code, mine_active = call('GET', '/api/inventory/?scope=mine', token=T['consumer'])
check('H2: archived item hidden from consumer active view',
      all(i['_id'] != CID for i in mine_active))
code, other = call('POST', '/api/inventory/', {
    'name': 'Other Consumer Item', 'category': 'Fruits', 'quantity': 1,
    'batch_number': f'LCX-{S}', 'packaging_type': 'Open',
}, token=T['consumer2'])
code, r = call('POST', f"/api/inventory/{other['_id']}/archive", {'reason': 'not mine'}, token=T['consumer'])
check('H3: consumer cannot archive another user\'s item (403)', code == 403, f'HTTP {code}')
code, r = call('POST', f"/api/inventory/{other['_id']}/sell", {'quantity_sold': 1}, token=T['consumer'])
check('H4: consumer cannot sell (403)', code == 403, f'HTTP {code}')

print("\n=== I. INSPECTOR VIEW-ONLY ===")
code, r = call('POST', '/api/inventory/', {
    'name': 'Inspector Contraband', 'category': 'Fruits', 'quantity': 1,
    'batch_number': f'LCI-{S}', 'packaging_type': 'Open',
}, token=T['inspector'])
check('I0: inspector cannot register inventory (403)', code == 403, f'HTTP {code}')
code, r = call('POST', f'/api/inventory/{WID}/sell', {'quantity_sold': 1}, token=T['inspector'])
check('I1: inspector cannot sell (403)', code == 403, f'HTTP {code}')
code, r = call('POST', f'/api/inventory/{ITEM}/archive', {'reason': 'x'}, token=T['inspector'])
check('I2: inspector cannot archive (403)', code == 403, f'HTTP {code}')
code, r = call('POST', f'/api/inventory/{ITEM}/dispose', {'quantity_disposed': 1, 'reason': 'x'},
               token=T['inspector'])
check('I3: inspector cannot dispose (403)', code == 403, f'HTTP {code}')
code, r = call('DELETE', f'/api/inventory/{ITEM}', token=T['inspector'])
check('I4: inspector cannot delete (403)', code == 403, f'HTTP {code}')
code, r = call('GET', f'/api/inventory/{ITEM}', token=T['inspector'])
check('I5: inspector CAN view items (200)', code == 200, f'HTTP {code}')
code, admin_item = call('POST', '/api/inventory/', {
    'name': 'Admin Registered Item', 'category': 'Fruits', 'quantity': 2,
    'batch_number': f'LCA-{S}', 'packaging_type': 'Open',
}, token=T['admin'])
check('I6: admin CAN register inventory', code == 200 and admin_item.get('status') == 'Active')
call('DELETE', f"/api/inventory/{admin_item['_id']}?confirm=DELETE-PERMANENTLY", token=T['admin'])

print("\n=== J. ADMIN AUTHORIZATION ===")
code, r = call('POST', f'/api/inventory/{ITEM}/sell', {'quantity_sold': 1}, token=T['admin'])
code, r = call('DELETE', f'/api/inventory/{ITEM}', token=T['admin'])
check('J1: admin delete without confirm token rejected (400)', code == 400, f'HTTP {code}')
code, r = call('DELETE', f'/api/inventory/{ITEM}?confirm=DELETE-PERMANENTLY', token=T['admin'])
check('J2: admin confirmed permanent delete succeeds', code == 200 and r.get('deleted') is True)
code, r = call('GET', f'/api/inventory/{ITEM}', token=T['retail'])
check('J3: deleted item is gone (404)', code == 404, f'HTTP {code}')
code, r = call('DELETE', f'/api/inventory/{WID}?confirm=DELETE-PERMANENTLY', token=T['retail'])
check('J4: non-admin cannot permanently delete (403)', code == 403, f'HTTP {code}')

print("\n=== K. PERSISTENCE (re-login) ===")
code, relogin = call('POST', '/api/auth/login',
                     {'username': USERS['warehouse'][0], 'password': 'testpass1'})
code, items2 = call('GET', '/api/inventory/?lifecycle=archived_view', token=relogin['access_token'])
yogurt = next((i for i in items2 if i['_id'] == WID), None)
check('K1: disposal state survives re-login',
      yogurt is not None and yogurt['status'] == 'Disposed' and yogurt['disposed_quantity'] == 10)

print("\n=== L. ANALYTICS UPDATE AFTER SALE/DISPOSAL ===")
code, active_item = call('POST', '/api/inventory/', {
    'name': 'Lifecycle Banana', 'category': 'Fruits', 'quantity': 30,
    'batch_number': f'LCN-{S}', 'temperature_c': 18.0, 'humidity_pct': 60.0,
    'packaging_type': 'Open', 'stored_at': '2026-09-27T08:00:00Z',
}, token=T['retail'])
BID = active_item['_id']
code, before = call('GET', '/api/recommendations/inventory-overview', token=T['retail'])
before_units = next((e['item']['quantity'] for e in before['items'] if e.get('item_id') == BID), None)
check('L1: new active item appears in insights with full quantity', before_units == 30)
code, r = call('POST', f'/api/inventory/{BID}/sell', {'quantity_sold': 25}, token=T['retail'])
code, after = call('GET', '/api/recommendations/inventory-overview', token=T['retail'])
after_qty = next((e['item'].get('quantity') for e in after['items'] if e.get('item_id') == BID), None)
check('L2: after partial sale insights use remaining quantity (5)',
      after_qty == 5, f'quantity={after_qty}')
code, r = call('POST', f'/api/inventory/{BID}/dispose', {'quantity_disposed': 5, 'reason': 'spoiled'},
               token=T['warehouse'])
code, after2 = call('GET', '/api/recommendations/inventory-overview', token=T['retail'])
check('L3: fully disposed item removed from insights',
      all(e.get('item_id') != BID for e in after2.get('items', [])))

print("\n=== CLEANUP (delete all test items as admin) ===")
for iid in (WID, CID, other['_id'], expired_item['_id'], BID):
    call('DELETE', f'/api/inventory/{iid}?confirm=DELETE-PERMANENTLY', token=T['admin'])
code, remaining = call('GET', '/api/inventory/?lifecycle=all', token=T['retail'])
gone = all(i['_id'] not in (ITEM, WID, CID, other['_id'], expired_item['_id'], BID) for i in remaining)
check('X1: all test items removed', gone)

failed = [(n, d) for n, ok, d in RESULTS if not ok]
print(f"\nRESULT: {len(RESULTS) - len(failed)}/{len(RESULTS)} lifecycle checks passed")
if failed:
    print('FAILED:')
    for n, d in failed:
        print(f'  - {n}: {d}')
    raise SystemExit(1)
print('ALL LIFECYCLE CHECKS PASSED')
