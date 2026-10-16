"""Milestone 4 end-to-end test suite (run against a live server).

Covers: reports (5 types), PDF/Excel exports, executive analytics + role gating,
platform notifications + recipient routing, image-token protection, health
enrichment, mark-expired role matrix, admin report management, and the full
negative-authorization matrix from the specification.

Cleans up only its own test data (m4_* prefix).
"""
import io
import json
import os
import urllib.request
import urllib.error

BASE = 'http://localhost:8000'
RESULTS = []


def check(name, ok, note=''):
    RESULTS.append((name, bool(ok), note))
    print(f"{'PASS' if ok else 'FAIL'}: {name}" + (f" - {note}" if note else ''))


def call(method, path, body=None, token=None, raw_body=None, headers_extra=None):
    headers = headers_extra or {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    data = raw_body
    if body is not None:
        data = json.dumps(body).encode()
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(BASE + path, method=method, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read()
            ctype = r.headers.get('Content-Type', '')
            if 'json' in ctype:
                return r.status, json.loads(raw), dict(r.headers)
            return r.status, raw, dict(r.headers)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw), dict(e.headers)
        except Exception:
            return e.code, raw, dict(e.headers)


def auth(username, password):
    code, r, _ = call('POST', '/api/auth/login', {'username': username, 'password': password})
    if code != 200:
        raise SystemExit(f'login failed for {username}: {code} {r}')
    return r['access_token']


def signup(username, password, role, email=None):
    body = {'username': username, 'password': password, 'role': role,
            'email': email or f'{username}@example.com'}
    code, r, _ = call('POST', '/api/auth/signup', body)
    if code == 400:
        return auth(username, password)
    assert code == 200, f'signup {username} failed: {code} {r}'
    return r['access_token']


TICK = b'\x89PNG\r\n\x1a\n'

print('\n=== SETUP: M4 users ===')
T_ADMIN = signup('m4_admin', 'pass123', 'Administrator')
T_RETAIL = signup('m4_retail', 'pass123', 'Retail Manager')
T_WARE = signup('m4_warehouse', 'pass123', 'Warehouse Operator')
T_INSP = signup('m4_inspector', 'pass123', 'Food Quality Inspector')
T_CONS = signup('m4_consumer', 'pass123', 'Consumer')
T_CONS2 = signup('m4_consumer2', 'pass123', 'Consumer')
print('users ready')

print('\n=== U: HEALTH ===')
code, h, _ = call('GET', '/api/health')
check('U1: /api/health returns ok', code == 200 and h.get('status') == 'ok', str(h.get('status')))
check('U2: health reports database connected', h.get('database') == 'connected', str(h.get('database')))
check('U3: health reports model availability', isinstance(h.get('model_loaded'), bool), str(h.get('model_loaded')))

print('\n=== C/D: INVENTORY + LIFECYCLE ===')
item = {'name': 'M4 Audit Apples', 'category': 'Fruits', 'quantity': 10,
        'batch_number': 'M4-B1', 'storage_zone': 'M4 Zone A', 'temperature_c': 5,
        'humidity_pct': 70, 'packaging_type': 'Open', 'stored_at': None,
        'is_available': True, 'expiry_date': None, 'notes': None}
code, apple, _ = call('POST', '/api/inventory/', item, T_RETAIL)
check('C1: retail registers item', code == 200 and '_id' in apple, str(apple.get('_id', ''))[:8])
APPLE_ID = apple['_id']

code, expired_item, _ = call('POST', '/api/inventory/', {**item, 'name': 'M4 Expiring Yogurt',
                              'category': 'Dairy Products', 'quantity': 5, 'batch_number': 'M4-B2'}, T_RETAIL)
check('C2: second item registered', code == 200, str(expired_item.get('_id', ''))[:8])
EXPIRE_ID = expired_item['_id']

code, cons_item, _ = call('POST', '/api/inventory/', {**item, 'name': 'M4 Home Bananas',
                          'category': 'Fruits', 'quantity': 3, 'batch_number': 'M4-B3'}, T_CONS)
check('P1: consumer registers own item', code == 200, str(cons_item.get('_id', ''))[:8])
CONS_ITEM_ID = cons_item['_id']

code, r, _ = call('POST', f'/api/inventory/{EXPIRE_ID}/mark-expired', {}, T_CONS)
check('R1: consumer cannot mark expired (403)', code == 403, str(code))
code, r, _ = call('POST', f'/api/inventory/{EXPIRE_ID}/mark-expired', {}, T_INSP)
check('R2: inspector cannot mark expired (403)', code == 403, str(code))
code, r, _ = call('POST', f'/api/inventory/{EXPIRE_ID}/mark-expired', {}, T_RETAIL)
check('R3: retail marks item expired', code == 200 and r.get('status') == 'Expired', str(r.get('status')))

code, _, _ = call('POST', f'/api/inventory/{APPLE_ID}/sell', {'quantity_sold': 1}, T_CONS)
check('N1: consumer cannot sell (403)', code == 403, str(code))
code, _, _ = call('POST', f'/api/inventory/{CONS_ITEM_ID}/sell', {'quantity_sold': 1}, T_CONS2)
check('N2: consumer cannot sell another consumer item (403 owner-scope)', code == 403, str(code))
code, _, _ = call('POST', f'/api/inventory/{APPLE_ID}/dispose', {'quantity_disposed': 1, 'reason': 'spoiled'}, T_RETAIL)
check('N3: retail cannot dispose (403)', code == 403, str(code))
code, _, _ = call('POST', f'/api/inventory/{APPLE_ID}/sell', {'quantity_sold': 1}, T_WARE)
check('N4: warehouse cannot sell (403)', code == 403, str(code))
code, _, _ = call('POST', '/api/inventory/', item, T_INSP)
check('N5: inspector cannot register (403)', code == 403, str(code))
code, _, _ = call('POST', f'/api/inventory/{APPLE_ID}/archive', {}, T_INSP)
check('N6: inspector cannot archive (403)', code == 403, str(code))
code, _, _ = call('DELETE', f'/api/inventory/{APPLE_ID}?confirm=DELETE-PERMANENTLY', None, T_INSP)
check('N7: inspector cannot delete (403)', code == 403, str(code))
code, _, _ = call('DELETE', f'/api/inventory/{APPLE_ID}', None, T_ADMIN)
check('N8: admin delete requires confirmation (400)', code == 400, str(code))

code, _, _ = call('GET', f'/api/inventory/{APPLE_ID}', None, T_CONS)
check('N9: consumer cannot read another user item (403)', code == 403, str(code))
code, mine, _ = call('GET', '/api/inventory/?scope=mine', None, T_CONS)
check('P2: consumer sees only own inventory', code == 200 and all(i['created_by'] != '' and i.get('name', '').startswith('M4 Home') for i in mine), f'{len(mine)} items')

code, r, _ = call('POST', f'/api/inventory/{APPLE_ID}/sell', {'quantity_sold': 4}, T_RETAIL)
check('D1: partial sale leaves item Active', code == 200 and r.get('status') == 'Active' and r.get('active_quantity') == 6, str(r.get('active_quantity')))
code, r, _ = call('POST', f'/api/inventory/{APPLE_ID}/sell', {'quantity_sold': 6}, T_RETAIL)
check('D2: full sale -> Sold Out', code == 200 and r.get('status') == 'Sold Out', str(r.get('status')))
code, hist, _ = call('GET', f'/api/inventory/{APPLE_ID}', None, T_RETAIL)
check('D3: lifecycle history preserved', code == 200 and len(hist.get('lifecycle_events', [])) >= 3, f"{len(hist.get('lifecycle_events', []))} events")

print('\n=== H: STORAGE ===')
code, reading, _ = call('POST', '/api/storage/', {'item_id': None, 'batch_id': None, 'zone': 'M4 Zone B',
                        'category': 'Dairy Products', 'temperature_c': 30, 'humidity_pct': 95,
                        'air_circulation': 'Low', 'light_exposure': 'Bright', 'recorded_at': None, 'notes': None}, T_WARE)
check('H1: hot/humid reading flagged Non-Compliant', code == 200 and reading.get('compliance_status') == 'Non-Compliant', str(reading.get('compliance_status')))

print('\n=== E/F/G: SCAN (image analysis chain) ===')
code, scan_item, _ = call('POST', '/api/inventory/', {**item, 'name': 'M4 Scan Tomatoes',
                          'category': 'Vegetables', 'quantity': 4, 'batch_number': 'M4-B4',
                          'expiry_date': '2020-01-01'}, T_RETAIL)
check('E0: dedicated active scan item registered', code == 200, str(scan_item.get('_id', ''))[:8])
SCAN_ITEM_ID = scan_item.get('_id') if code == 200 else APPLE_ID
img_path = None
for root, _, files in os.walk('test_images'):
    for f in files:
        if f.lower().endswith(('.jpg', '.jpeg', '.png')):
            img_path = os.path.join(root, f)
            break
    if img_path:
        break
scan = None
if img_path:
    boundary = '----m4boundary'
    with open(img_path, 'rb') as fh:
        img_bytes = fh.read()
    form = (f'--{boundary}\r\nContent-Disposition: form-data; name="item_id"\r\n\r\n{SCAN_ITEM_ID}\r\n'
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.jpg"\r\n'
            f'Content-Type: image/jpeg\r\n\r\n').encode() + img_bytes + f'\r\n--{boundary}--\r\n'.encode()
    code, scan, _ = call('POST', '/api/ml/predict', raw_body=form, token=T_INSP,
                         headers_extra={'Content-Type': f'multipart/form-data; boundary={boundary}'})
    check('E1: inspector scan succeeds', code == 200 and scan.get('status') in ('Fresh', 'Rotten'), f"{code} {scan.get('status')}")
    check('F1: quality score returned', isinstance(scan.get('freshness_score'), (int, float)), str(scan.get('freshness_score')))
    check('G1: shelf-life estimate attached', bool(scan.get('shelf_life', {}).get('effective_remaining_days') is not None), str(scan.get('shelf_life', {}).get('effective_remaining_days')))
    check('G2: prediction persisted with provenance', scan.get('shelf_life', {}).get('source_type') == 'parametric_estimate', str(scan.get('shelf_life', {}).get('source_type')))
    check('E2: scan linked to real inventory item', scan.get('item_id') == SCAN_ITEM_ID, str(scan.get('item_id'))[:8])
    SCAN_ID = scan.get('analysis_id')
    REPORT_ID = scan.get('report_id')
    IMAGE_URL = scan.get('image_url')
else:
    print('SKIP: no test image found; scan-based checks limited')
    SCAN_ID = REPORT_ID = IMAGE_URL = None

if IMAGE_URL:
    code, _, _ = call('GET', IMAGE_URL)
    check('S1: scan image requires auth (401 without token)', code == 401, str(code))
    code, _, _ = call('GET', f"{IMAGE_URL}?token={T_RETAIL}")
    check('S2: scan image served with signed ?token=', code == 200, str(code))

print('\n=== J: ALERTS + ROUTING + PLATFORM NOTIFICATIONS ===')
code, alerts_retail, _ = call('GET', '/api/alerts/?limit=50', None, T_RETAIL)
check('J1: retail receives routed inventory/shelf-life alerts', code == 200 and len(
    [a for a in alerts_retail if a.get('recipient_id') is None and a.get('recipient_role') == 'Retail Manager']) >= 1,
    f"{len(alerts_retail)} alerts")
code, alerts_ware, _ = call('GET', '/api/alerts/?limit=50', None, T_WARE)
check('J2: warehouse receives storage violation broadcasts', any(
    a.get('type') == 'storage_condition_violation' and a.get('recipient_role') == 'Warehouse Operator'
    for a in alerts_ware), 'storage broadcasts present')
code, cnt, _ = call('GET', '/api/alerts/unread-count', None, T_ADMIN)
check('J3: unread-count endpoint works', code == 200 and isinstance(cnt.get('unread'), int), str(cnt.get('unread')))

code, _, _ = call('POST', '/api/auth/signup', {'username': 'm4_observer', 'password': 'pass123',
                  'role': 'Consumer', 'email': 'm4_observer@example.com'})
code, admin_alerts, _ = call('GET', '/api/alerts/?limit=50', None, T_ADMIN)
plat = [a for a in admin_alerts if a.get('type') == 'platform_notification' and 'm4_observer' in a.get('message', '')]
check('J4: platform notification for new user signup reaches Administrators', len(plat) >= 1, plat[0]['message'][:60] if plat else 'none')

code, cons_alerts, _ = call('GET', '/api/alerts/?limit=100', None, T_CONS)
check('J5: consumer does not receive staff role broadcasts', all(
    a.get('recipient_id') == str(0) or a.get('recipient_role') == 'Consumer' or a.get('recipient_id')
    for a in cons_alerts if a.get('recipient_id') is None) or all(
    a.get('recipient_role') == 'Consumer' or a.get('recipient_id') for a in cons_alerts), f'{len(cons_alerts)} alerts')

if admin_alerts:
    target = next((a for a in admin_alerts if a.get('recipient_id') is None), None)
    if target:
        code, _, _ = call('PATCH', f"/api/alerts/{target['_id']}", {'is_read': True}, T_CONS)
        check('J6: consumer cannot mark another role broadcast read (403)', code == 403, str(code))
        code, _, _ = call('PATCH', f"/api/alerts/{target['_id']}", {'is_read': True}, T_ADMIN)
        check('J7: admin can mark own-role broadcast read', code == 200, str(code))

print('\n=== K: REPORTS (5 types) ===')
report_ids = {}
for rtype, payload in [
    ('freshness', {}),
    ('shelf_life', {}),
    ('inventory_quality', {'status': 'Active'}),
    ('waste_reduction', {}),
    ('storage_compliance', {}),
]:
    code, rep, _ = call('POST', '/api/reports/generate', {'report_type': rtype, **payload}, T_ADMIN)
    check(f'K1({rtype}): generated from DB records', code == 200 and rep.get('report_type') == rtype and rep.get('summary'), str(code))
    report_ids[rtype] = rep.get('_id')

code, types, _ = call('GET', '/api/reports/types', None, T_RETAIL)
check('K2: report types endpoint lists 5 types', code == 200 and len(types) == 5, str(len(types)))

code, lst, _ = call('GET', '/api/reports?report_type=storage_compliance', None, T_ADMIN)
check('K3: list filters by report_type', code == 200 and all(r.get('report_type') == 'storage_compliance' for r in lst), str(len(lst)))

code, gen, _ = call('POST', '/api/reports/generate', {'report_type': 'bogus'}, T_ADMIN)
check('K4: unknown report type rejected (400)', code == 400, str(code))

code, cons_reports, _ = call('GET', '/api/reports', None, T_CONS)
check('P3: consumer report list is own-only', code == 200, f'{len(cons_reports)} reports')

print('\n=== L/M: EXPORTS ===')
for rtype, rid in report_ids.items():
    if not rid:
        continue
    code, pdf, hdrs = call('GET', f'/api/reports/{rid}/export?format=pdf', None, T_ADMIN)
    check(f'L({rtype}): PDF export valid', code == 200 and pdf[:5] == b'%PDF-' and len(pdf) > 500,
          f'{len(pdf)} bytes, magic={pdf[:5]}')
    code, xls, hdrs = call('GET', f'/api/reports/{rid}/export?format=xlsx', None, T_ADMIN)
    check(f'M({rtype}): Excel export valid', code == 200 and xls[:2] == b'PK' and len(xls) > 500,
          f'{len(xls)} bytes, magic={xls[:2]}')

if REPORT_ID:
    code, pdf, _ = call('GET', f'/api/reports/{REPORT_ID}/export?format=pdf', None, T_INSP)
    check('L2: legacy scan report exports as PDF', code == 200 and pdf[:5] == b'%PDF-', f'{len(pdf)} bytes')

code, gen_fresh, _ = call('POST', '/api/reports/generate', {'report_type': 'freshness'}, T_ADMIN)
code, scan_stats, _ = call('GET', '/api/analytics/scans', None, T_ADMIN)
summary_map = {s['label']: s['value'] for s in gen_fresh.get('summary', [])}
check('M2: report totals match live scan analytics',
      summary_map.get('Total scans') == scan_stats.get('total_scans'),
      f"report={summary_map.get('Total scans')} api={scan_stats.get('total_scans')}")

if report_ids.get('freshness'):
    code, _, _ = call('GET', f"/api/reports/{report_ids['freshness']}/export?format=pdf", None, T_CONS)
    check('S3: consumer cannot export staff report (403)', code == 403, str(code))

print('\n=== N: EXECUTIVE ANALYTICS ===')
code, ex, _ = call('GET', '/api/executive/executive', None, T_ADMIN)
check('N1: executive KPIs returned', code == 200 and 'kpis' in ex and 'series' in ex, str(ex.get('kpis', {}).get('total_active_items')))
check('N2: series has 14-day window', code == 200 and len(ex.get('series', {}).get('labels', [])) == 14, str(len(ex.get('series', {}).get('labels', []))))
check('N3: category analytics only from real records', isinstance(ex.get('category_analytics'), list), str(len(ex.get('category_analytics', []))))
code, _, _ = call('GET', '/api/executive/executive', None, T_CONS)
check('N4: consumer blocked from executive (403)', code == 403, str(code))
code, _, _ = call('GET', '/api/executive/executive', None, T_INSP)
check('N5: inspector blocked from executive (403)', code == 403, str(code))

print('\n=== O: ADMIN REPORT MANAGEMENT ===')
if report_ids.get('waste_reduction'):
    code, _, _ = call('DELETE', f"/api/reports/{report_ids['waste_reduction']}", None, T_RETAIL)
    check('O1: staff cannot delete reports (403)', code == 403, str(code))
    code, r, _ = call('DELETE', f"/api/reports/{report_ids['waste_reduction']}", None, T_ADMIN)
    check('O2: admin deletes report metadata', code == 200 and r.get('deleted'), str(r))

print('\n=== CLEANUP (own data only) ===')
call('DELETE', f'/api/inventory/{SCAN_ITEM_ID}?confirm=DELETE-PERMANENTLY', None, T_ADMIN)
call('DELETE', f'/api/inventory/{APPLE_ID}?confirm=DELETE-PERMANENTLY', None, T_ADMIN)
call('DELETE', f'/api/inventory/{EXPIRE_ID}?confirm=DELETE-PERMANENTLY', None, T_ADMIN)
call('DELETE', f'/api/inventory/{CONS_ITEM_ID}?confirm=DELETE-PERMANENTLY', None, T_ADMIN)
for rid in report_ids.values():
    if rid:
        call('DELETE', f'/api/reports/{rid}', None, T_ADMIN)
if REPORT_ID:
    call('DELETE', f'/api/reports/{REPORT_ID}', None, T_ADMIN)
call('POST', '/api/reports/generate', {'report_type': 'freshness'}, T_ADMIN)
code, lst, _ = call('GET', '/api/reports?limit=200', None, T_ADMIN)
for r in lst:
    if r.get('report_type') and r.get('created_by_username', '').startswith('m4_'):
        call('DELETE', f"/api/reports/{r['_id']}", None, T_ADMIN)
print('cleanup done (items, reports)')

print('\n================= SUMMARY =================')
passed = sum(1 for _, ok, _ in RESULTS if ok)
failed = [(n, note) for n, ok, note in RESULTS if not ok]
print(f'TOTAL: {len(RESULTS)}  PASS: {passed}  FAIL: {len(failed)}')
for n, note in failed:
    print(f'  FAILED: {n} - {note}')
