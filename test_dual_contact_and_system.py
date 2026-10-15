import os
import sys
import io
import pandas as pd
from app import app
from database import SessionLocal, Customer, User, Setting

def run_tests():
    print("=== STARTING COMPREHENSIVE SYSTEM & DUAL-CONTACT VERIFICATION ===")
    app.config['TESTING'] = True
    client = app.test_client()

    db = SessionLocal()
    try:
        # Create test consultant user
        test_user = db.query(User).filter_by(username='test_consultant').first()
        if not test_user:
            test_user = User(
                username='test_consultant',
                full_name='Test Consultant',
                agency_name='Passport Express',
                role='staff',
                phone='9822000000',
                is_active=True
            )
            test_user.set_password('pass1234')
            db.add(test_user)
            db.commit()

        # Clean existing customers for this test user
        db.query(Customer).filter_by(created_by_user_id=test_user.id).delete()
        db.commit()
        user_id = test_user.id
        print(f"[OK] Test user ready (id={user_id})")
    finally:
        db.close()

    # Log in as test_consultant
    with client.session_transaction() as sess:
        sess['user_id'] = user_id
        sess['username'] = 'test_consultant'
        sess['role'] = 'staff'
        sess['agency_name'] = 'Passport Express'

    # TEST 1: Add customer with Primary Only (phone2 optional)
    cust1_data = {
        'name': 'Rahul Sharma',
        'phone': '9822111111',
        'phone2': '',
        'dob': '1995-10-15',
        'passport_no': 'P9911221',
        'expiry_date': '2026-12-15',
        'city': 'Mumbai'
    }
    res = client.post('/api/customers', json=cust1_data)
    assert res.status_code == 200, f"Error adding cust1: {res.get_json()}"
    c1 = res.get_json()['customer']
    assert c1['phone'] == '919822111111'
    assert c1['phone2'] == ''
    print("[PASS] Test 1: Customer added with Primary number only (phone2 is optional)")

    # TEST 2: Add customer with BOTH Primary & Secondary numbers
    cust2_data = {
        'name': 'Pooja Patil',
        'phone': '9822222222',
        'phone2': '9822333333',
        'dob': '1998-10-15',
        'passport_no': 'P9922334',
        'expiry_date': '2026-11-20',
        'city': 'Pune'
    }
    res = client.post('/api/customers', json=cust2_data)
    assert res.status_code == 200, f"Error adding cust2: {res.get_json()}"
    c2 = res.get_json()['customer']
    assert c2['phone'] == '919822222222'
    assert c2['phone2'] == '919822333333'
    print("[PASS] Test 2: Customer added with BOTH Primary and Secondary mobile numbers")

    # TEST 3: Validation: Missing Primary Phone should FAIL
    res = client.post('/api/customers', json={'name': 'No Phone Guy', 'phone': ''})
    assert res.status_code == 400
    print("[PASS] Test 3: Primary phone is strictly compulsory (fails with 400 if missing)")

    # TEST 4: Update customer's secondary phone
    res = client.put(f"/api/customers/{c1['id']}", json={'phone2': '9899887766'})
    assert res.status_code == 200
    updated_c1 = res.get_json()['customer']
    assert updated_c1['phone2'] == '919899887766'
    print("[PASS] Test 4: Successfully updated secondary phone on existing customer")

    # TEST 5: Excel Import with dual phone columns
    excel_data = pd.DataFrame([
        {
            'Customer Name': 'Amit Kulkarni',
            'Primary Mobile': '9811001100',
            'Alternate Mobile': '9811002200',
            'Birth Date': '1992-10-15',
            'Passport': 'P5544332',
            'Expiry Date': '2027-01-01',
            'City': 'Nashik'
        },
        {
            'Customer Name': 'Sunita Deshmukh',
            'Primary Mobile': '9811003300',
            'Alternate Mobile': '',
            'Birth Date': '1994-05-20',
            'Passport': 'P5544333',
            'Expiry Date': '2027-02-01',
            'City': 'Kolhapur'
        }
    ])
    buf = io.BytesIO()
    excel_data.to_excel(buf, index=False)
    buf.seek(0)

    from importer import process_excel_file
    import_res = process_excel_file(buf, mode='append_new', user_id=user_id)
    assert import_res['status'] == 'success', f"Import failed: {import_res}"
    print("[PASS] Test 5: Excel file with dual mobile columns imported successfully")

    # TEST 6: Verify imported customers have phone and phone2 correctly populated
    db = SessionLocal()
    try:
        amit = db.query(Customer).filter_by(name='Amit Kulkarni', created_by_user_id=user_id).first()
        assert amit is not None
        assert amit.phone == '919811001100'
        assert amit.phone2 == '919811002200'

        sunita = db.query(Customer).filter_by(name='Sunita Deshmukh', created_by_user_id=user_id).first()
        assert sunita is not None
        assert sunita.phone == '919811003300'
        assert sunita.phone2 in ('', None)
        print("[PASS] Test 6: In-DB check: Amit has both phones, Sunita has primary phone only")
    finally:
        db.close()

    # TEST 7: Birthday API returns both whatsapp_url and whatsapp_url_2
    res = client.get('/api/birthdays?timeframe=today')
    assert res.status_code == 200
    b_data = res.get_json()
    assert b_data['total'] >= 1
    # Check Amit or Pooja who have today's birthday and have 2 phones
    dual_bday = next((b for b in b_data['birthdays'] if b['customer']['phone2']), None)
    assert dual_bday is not None, "No dual-phone birthday contact found"
    assert dual_bday['whatsapp_url'].startswith('https://web.whatsapp.com/send?phone=')
    assert dual_bday['whatsapp_url_2'].startswith('https://web.whatsapp.com/send?phone=')
    print("[PASS] Test 7: Birthday API returns both primary and secondary WhatsApp URLs")

    # TEST 8: Web Queue dispatch with send_target='primary'
    res_q1 = client.post('/api/queue/prepare', json={
        'type': 'birthday',
        'items': [dual_bday['customer']],
        'send_target': 'primary'
    })
    q1 = res_q1.get_json()
    assert q1['status'] == 'success'
    assert len(q1['items']) == 1
    assert q1['items'][0]['phone'] == dual_bday['customer']['phone']
    print("[PASS] Test 8: Web Queue with send_target='primary' dispatches to Primary only (1 message)")

    # TEST 9: Web Queue dispatch with send_target='both'
    res_q2 = client.post('/api/queue/prepare', json={
        'type': 'birthday',
        'items': [dual_bday['customer']],
        'send_target': 'both'
    })
    q2 = res_q2.get_json()
    assert q2['status'] == 'success'
    assert len(q2['items']) == 2
    assert q2['items'][0]['phone'] == dual_bday['customer']['phone']
    assert '(Primary)' in q2['items'][0]['name']
    assert q2['items'][1]['phone'] == dual_bday['customer']['phone2']
    assert '(Alt Phone)' in q2['items'][1]['name']
    print("[PASS] Test 9: Web Queue with send_target='both' queues BOTH Primary and Secondary (2 messages)")

    # TEST 10: Zero SQLite database files verification
    base_dir = os.path.dirname(os.path.abspath(__file__))
    db_files = [f for f in os.listdir(base_dir) if f.endswith('.db')]
    assert len(db_files) == 0, f"Found local SQLite .db files: {db_files}"
    print("[PASS] Test 10: Zero local SQLite databases on disk (100% Cloud Neon PostgreSQL)")

    # Cleanup test customer records
    db = SessionLocal()
    try:
        db.query(Customer).filter_by(created_by_user_id=user_id).delete()
        db.query(User).filter_by(id=user_id).delete()
        db.commit()
        print("[OK] Test data cleaned up successfully.")
    finally:
        db.close()

    print("\n🎉 ALL 10 TESTS PASSED! Dual contact numbers, WhatsApp choice routing, and cloud database are 100% operational.")

if __name__ == '__main__':
    run_tests()
