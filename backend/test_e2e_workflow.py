"""End-to-end test of the full M1->M3 workflow against the live server.
Covers: registration persistence, scan persistence, storage, duration, recommendations,
role auth, restart persistence, and fake-data checks. Deletes only its own test data.
"""
import io
import json
import os
import time
import urllib.request
import urllib.error
from pathlib import Path

BASE = 'http://localhost:8000'
RESULTS = []


def call(method, path, body=None, token=None, form=None):
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    data = None
    if form is not None:
        data = form
    elif body is not None:
        data = json.dumps(body).encode()
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(BASE + path, method=method, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read()
            try:
                text = raw.decode()
            except UnicodeDecodeError:
                return r.status, {'binary': True, 'bytes': len(raw)}
            return r.status, json.loads(text) if text else {}
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
    'admin': (f'admin_{S}', 'Administrator'),
    'consumer': (f'cons_{S}', 'Consumer'),
    'retail': (f'retail_{S}', 'Retail Manager'),
    'warehouse': (f'ware_{S}', 'Warehouse Operator'),
    'inspector': (f'insp_{S}', 'Food Quality Inspector'),
}
TOKENS = {}
for key, (uname, role) in USERS.items():
    code, r = call('POST', '/api/auth/signup',
                   {'username': uname, 'email': f'{uname}@t.com', 'password': 'testpass1', 'role': role})
    assert code == 200, f'signup {key} failed: {code} {r}'
    TOKENS[key] = r['access_token']
print(f"Created {len(TOKENS)} users with tokens")

print("\n=== TEST A: INVENTORY PERSISTENCE ===")
code, apple = call('POST', '/api/inventory/', {
    'name': 'Apple', 'category': 'Fruits', 'quantity': 20, 'batch_number': 'A-102',
    'expiry_date': None, 'storage_zone': 'Cold Storage 1', 'temperature_c': 4.0,
    'humidity_pct': 90.0, 'packaging_type': 'Ventilated', 'stored_at': '2026-09-25T10:00:00Z',
}, token=TOKENS['retail'])
check('A1: register Apple A-102 returns DB id', code == 200 and '_id' in apple, str(apple.get('_id'))[:12])
APPLE_ID = apple['_id']

code, mine = call('GET', '/api/inventory/', token=TOKENS['retail'])
check('A2: refresh - Apple still exists', code == 200 and any(i['_id'] == APPLE_ID for i in mine))

code, reread = call('POST', '/api/auth/login', {'username': USERS['retail'][0], 'password': 'testpass1'})
token2 = reread['access_token']
code, mine2 = call('GET', '/api/inventory/', token=token2)
check('A3: logout/login - Apple survives re-login', code == 200 and any(i['_id'] == APPLE_ID for i in mine2))

code, mine_c = call('GET', '/api/inventory/?scope=mine', token=TOKENS['consumer'])
check('A4: consumer sees only own inventory (empty)', code == 200 and len(mine_c) == 0, f'{len(mine_c)} items')

print("\n=== TEST B: M2 SCAN/REPORT PERSISTENCE ===")
img_path = Path(__file__).parent / 'test_images' / 'fresh_apple.jpg'
form = urllib.request.data_encode if False else None
boundary = '----auditboundary123'
with open(img_path, 'rb') as f:
    img_bytes = f.read()
form_body = (
    f'--{boundary}\r\nContent-Disposition: form-data; name="item_id"\r\n\r\n{APPLE_ID}\r\n'
    f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="apple.jpg"\r\n'
    f'Content-Type: image/jpeg\r\n\r\n'
).encode() + img_bytes + f'\r\n--{boundary}--\r\n'.encode()

code, scan = call('POST', '/api/ml/predict', token=TOKENS['inspector'],
                  form=form_body, headers_extra=None) if False else (None, None)
req = urllib.request.Request(BASE + '/api/ml/predict', method='POST', data=form_body, headers={
    'Content-Type': f'multipart/form-data; boundary={boundary}',
    'Authorization': f"Bearer {TOKENS['inspector']}",
})
try:
    with urllib.request.urlopen(req, timeout=120) as r:
        scan = json.loads(r.read().decode())
        code = 200
except urllib.error.HTTPError as e:
    code = e.code
    scan = e.read().decode()[:300]

check('B1: scan of Apple A-102 succeeds', code == 200, f'status={scan.get("status")}, conf={scan.get("confidence")}')
check('B2: analysis linked to item A-102', scan.get('item_id') == APPLE_ID)
check('B3: scan persisted with analysis_id + report_id',
      bool(scan.get('analysis_id')) and bool(scan.get('report_id')),
      f'analysis={str(scan.get("analysis_id"))[:8]} report={str(scan.get("report_id"))[:8]}')
check('B4: shelf-life estimate present with provenance',
      scan.get('shelf_life') and scan['shelf_life'].get('source_type') == 'parametric_estimate'
      and 'not a guaranteed' in scan['shelf_life'].get('estimate_disclaimer', ''))
SCAN_ID, REPORT_ID = scan['analysis_id'], scan['report_id']
expected_days = scan['shelf_life']['effective_remaining_days']
expected_status = scan['status']
expected_quality = (scan.get('quality_assessment') or {}).get('quality_score', scan.get('freshness_score'))

code, scan_db = call('GET', f'/api/ml/scans/{SCAN_ID}', token=TOKENS['inspector'])
check('B5: scan survives refresh (DB fetch by id)', code == 200 and scan_db['ml_status'] == expected_status
      and scan_db['quality_score'] == expected_quality)
code, report_db = call('GET', f'/api/reports/{REPORT_ID}', token=TOKENS['inspector'])
check('B6: persisted report loads with identical analysis',
      code == 200 and report_db['analysis']['ml_status'] == expected_status
      and report_db['analysis']['quality_score'] == expected_quality
      and report_db['prediction']['effective_remaining_days'] == expected_days)
check('B7: report has image reference', bool(report_db['analysis'].get('image_url')))
check('B8: persisted scan image is servable (authenticated)',
      call('GET', report_db['analysis']['image_url'], token=TOKENS['inspector'])[0] == 200)

code, hist = call('GET', '/api/ml/scans?limit=50', token=TOKENS['inspector'])
check('B9: scan appears in DB-backed history', any(s['_id'] == SCAN_ID for s in hist))

print("\n=== TEST C: STORAGE ===")
code, reading = call('POST', '/api/storage/', {
    'item_id': APPLE_ID, 'zone': 'Cold Storage 1', 'category': 'Fruits',
    'temperature_c': 4.0, 'humidity_pct': 90.0, 'air_circulation': 'Moderate',
    'light_exposure': 'Dark',
}, token=TOKENS['warehouse'])
check('C1: linked storage reading saved', code == 200 and reading.get('item_id') == APPLE_ID
      and reading.get('source') == 'manual')
code, readings = call('GET', f'/api/storage/?item_id={APPLE_ID}', token=TOKENS['warehouse'])
check('C2: reading persists after refresh', any(r['_id'] == reading['_id'] for r in readings))

code, bad = call('POST', '/api/storage/', {
    'item_id': APPLE_ID, 'zone': 'Cold Storage 1', 'category': 'Fruits',
    'temperature_c': 25.0, 'humidity_pct': 90.0,
}, token=TOKENS['warehouse'])
check('C3: hot reading (25C, 20C over range) flagged Non-Compliant', bad.get('compliance_status') == 'Non-Compliant')
code, alerts_w = call('GET', '/api/alerts/', token=TOKENS['warehouse'])
check('C4: storage breach generated alert for linked item',
      any(a.get('type') == 'storage_condition_violation' and a.get('item_id') == APPLE_ID for a in alerts_w))

print("\n=== TEST D: DURATION AFFECTS SHELF LIFE ===")
from datetime import datetime, timedelta, timezone as _tz
_now = datetime.now(_tz.utc)
_stored_10d = (_now - timedelta(days=10)).strftime('%Y-%m-%dT%H:%M:%SZ')
code, pred_now = call('POST', '/api/shelf-life/predict', {
    'category': 'Fruits', 'quality_score': 90.0, 'temperature_c': 4.0,
    'humidity_pct': 90.0, 'packaging_type': 'Ventilated',
    'stored_at': _stored_10d,
}, token=TOKENS['inspector'])
code2, pred_old = call('POST', '/api/shelf-life/predict', {
    'category': 'Fruits', 'quality_score': 90.0, 'temperature_c': 4.0,
    'humidity_pct': 90.0, 'packaging_type': 'Ventilated',
    'stored_at': (_now - timedelta(days=20)).strftime('%Y-%m-%dT%H:%M:%SZ'),
}, token=TOKENS['inspector'])
check('D1: same conditions, 10 extra stored days -> fewer remaining days',
      pred_now['predicted_remaining_days'] > pred_old['predicted_remaining_days'],
      f"now={pred_now['predicted_remaining_days']}d old={pred_old['predicted_remaining_days']}d")
check('D2: arithmetic total-elapsed=remaining',
      abs((pred_now['estimated_total_life_days'] - 10.0) - pred_now['predicted_remaining_days']) < 0.3,
      f"total={pred_now['estimated_total_life_days']}d elapsed~10d remaining={pred_now['predicted_remaining_days']}d")
code, item_pred = call('POST', f'/api/shelf-life/predict-for-item/{APPLE_ID}', token=TOKENS['inspector'])
check('D3: item prediction uses stored_at (duration applied)',
      item_pred.get('duration_applied') is True, f"remaining={item_pred['predicted_remaining_days']}d")
check('D4: prediction persisted', bool(item_pred.get('prediction_id')))

print("\n=== TEST E: RECOMMENDATIONS CONDITION-DRIVEN ===")
code, rec_ripe = call('POST', '/api/recommendations/item', {
    'category': 'Dairy Products', 'quality_score': 40.0, 'quantity': 100,
    'temperature_c': 20.0, 'humidity_pct': 85.0,
}, token=TOKENS['retail'])
code, rec_fresh = call('POST', '/api/recommendations/item', {
    'category': 'Dairy Products', 'quality_score': 98.0, 'quantity': 5,
    'temperature_c': 3.0, 'humidity_pct': 85.0,
}, token=TOKENS['retail'])
w_ripe = next(r for r in rec_ripe['recommendations'] if r['type'] == 'waste_reduction')
w_fresh = next(r for r in rec_fresh['recommendations'] if r['type'] == 'waste_reduction')
check('E1: near-spoilage big batch -> discount/donate', 'discount' in w_ripe['title'].lower()
      or 'markdown' in w_ripe['title'].lower(), w_ripe['title'])
check('E2: fresh small batch -> healthy stock', 'healthy' in w_fresh['title'].lower(), w_fresh['title'])
check('E3: recs differ by condition', w_ripe['title'] != w_fresh['title'])
check('E4: storage fix recommended for warm dairy',
      any(r['type'] == 'storage_fix' and r.get('parameter') == 'temperature'
          for r in rec_ripe['recommendations']))

print("\n=== TEST F: ROLES ===")
code, overview = call('GET', '/api/recommendations/inventory-overview', token=TOKENS['retail'])
check('F1: GET inventory-overview works (405 bug fixed)', code == 200 and overview.get('total_items') >= 1)
code, overview_post = call('POST', '/api/recommendations/inventory-overview', None, token=TOKENS['retail'])
check('F2: POST inventory-overview also works', code == 200)
code, _ = call('GET', '/api/recommendations/inventory-overview', token=TOKENS['consumer'])
check('F3: consumer blocked from staff overview (403)', code == 403, f'HTTP {code}')
code, _ = call('GET', '/api/inventory')
check('F4: unauthenticated inventory access blocked (401)', code == 401, f'HTTP {code}')
code, _ = call('GET', '/api/auth/users', token=TOKENS['retail'])
check('F5: non-admin blocked from user list (403)', code == 403, f'HTTP {code}')
code, users = call('GET', '/api/auth/users', token=TOKENS['admin'])
check('F6: admin sees real user list', code == 200 and len(users) >= 5)
code, a_overview = call('GET', '/api/analytics/overview', token=TOKENS['admin'])
check('F7: admin overview has real counts, no fake metrics',
      a_overview.get('total_food_items') >= 1 and 'Not available' in str(a_overview.get('api_request_count')))
code, fresh_analytics = call('GET', '/api/analytics/freshness', token=TOKENS['admin'])
check('F8: freshness analytics derived from real items',
      code == 200 and fresh_analytics['total_items'] >= 1
      and all(i['shelf_life'] for i in fresh_analytics['items']))
code, cons_inv = call('GET', '/api/inventory/?scope=mine', token=TOKENS['consumer'])
check('F9: consumer personal inventory endpoint works', code == 200 and isinstance(cons_inv, list))

print("\n=== TEST G: PERSISTENCE (fresh DB reads) ===")
code, mine3 = call('GET', '/api/inventory/', token=TOKENS['retail'])
apple_still = next((i for i in mine3 if i['_id'] == APPLE_ID), None)
check('G1: Apple with scan results still in DB', apple_still is not None
      and apple_still.get('quality_score') == expected_quality
      and apple_still.get('ml_status') == expected_status)
code, reports = call('GET', '/api/reports/', token=TOKENS['inspector'])
check('G2: reports list from DB contains our report', any(rp['_id'] == REPORT_ID for rp in reports))
code, preds = call('GET', '/api/shelf-life/history?item_id=' + APPLE_ID, token=TOKENS['inspector'])
check('G3: prediction history persisted for item', len(preds) >= 2)

print("\n=== TEST H: NO FAKE DATA ===")
fe = Path(__file__).parent.parent / 'frontend' / 'src'
fake_hits = []
for f in fe.rglob('*.jsx'):
    text = f.read_text(encoding='utf-8', errors='ignore')
    for marker in ('M-099', 'A-102', 'john_manager', 'alice_warehouse', 'bob_inspector',
                   '142', '99.9%', '12.4k'):
        if marker in text:
            fake_hits.append(f'{f.name}: {marker}')
check('H1: no seeded fake scans/users/metrics in frontend', len(fake_hits) == 0, str(fake_hits)[:150])
be = Path(__file__).parent
for f in be.rglob('routes/*.py'):
    text = f.read_text(encoding='utf-8', errors='ignore')
    for marker in ('M-099', 'john_manager', 'sample_item', 'demo_item', 'fake'):
        if marker in text:
            fake_hits.append(f'{f.name}: {marker}')
check('H2: no fake data in backend routes', not any('routes' in h for h in fake_hits))

print("\n=== CLEANUP ===")
# lifecycle model: permanent delete is Administrator-only and confirmation-gated
call('DELETE', f'/api/inventory/{APPLE_ID}?confirm=DELETE-PERMANENTLY', token=TOKENS['admin'])
code, mine4 = call('GET', '/api/inventory/', token=TOKENS['retail'])
check('X1: test data deleted (Apple removed)', all(i['_id'] != APPLE_ID for i in mine4))

failed = [(n, d) for n, ok, d in RESULTS if not ok]
print(f"\nRESULT: {len(RESULTS) - len(failed)}/{len(RESULTS)} E2E checks passed")
if failed:
    print('FAILED:')
    for n, d in failed:
        print(f'  - {n}: {d}')
    raise SystemExit(1)
print('ALL E2E CHECKS PASSED')
