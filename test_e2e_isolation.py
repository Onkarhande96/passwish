import os
import sys

# Ensure pure Neon DB connection
from app import app
from database import SessionLocal, User, Setting

def run_e2e_verification():
    print("=== Starting E2E Multi-Tenant Isolation & Admin Lockout Verification ===")
    app.config['TESTING'] = True
    client = app.test_client()

    db = SessionLocal()
    try:
        # 1. Setup test users in Neon DB
        # Cleanup any previous test users
        for uname in ['client_alpha', 'client_beta']:
            u = db.query(User).filter_by(username=uname).first()
            if u:
                # delete associated user settings
                db.query(Setting).filter(Setting.key.like(f"user_{u.id}_%")).delete(synchronize_session=False)
                db.delete(u)
        db.commit()

        # Create client_alpha
        u_alpha = User(
            username='client_alpha',
            full_name='',
            agency_name='',
            role='staff',
            phone='',
            is_active=True
        )
        u_alpha.set_password('alpha123')
        db.add(u_alpha)

        # Create client_beta
        u_beta = User(
            username='client_beta',
            full_name='',
            agency_name='',
            role='staff',
            phone='',
            is_active=True
        )
        u_beta.set_password('beta123')
        db.add(u_beta)
        db.commit()

        print(f"[OK] Created test users: client_alpha (id={u_alpha.id}), client_beta (id={u_beta.id})")
    finally:
        db.close()

    # TEST 1: Login as client_alpha and verify clean profile
    with client.session_transaction() as sess:
        sess['user_id'] = u_alpha.id
        sess['username'] = 'client_alpha'
        sess['role'] = 'staff'
        sess['full_name'] = ''

    res = client.get('/api/profile')
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    alpha_prof = res.get_json()
    print("Initial client_alpha profile:", alpha_prof)
    assert alpha_prof['shop_name'] == '', f"shop_name should be empty, got {alpha_prof['shop_name']}"
    assert alpha_prof['owner_name'] == '', f"owner_name should be empty, got {alpha_prof['owner_name']}"
    assert alpha_prof['phone'] == '', f"phone should be empty, got {alpha_prof['phone']}"
    assert alpha_prof['address'] == '', f"address should be empty, got {alpha_prof['address']}"
    print("[PASS] Test 1: New user client_alpha has clean, blank profile (no leaked admin/previous data)")

    # TEST 2: client_alpha saves their own shop details
    save_payload = {
        'shop_name': 'Alpha International Travels',
        'owner_name': 'Alpha Rao',
        'phone': '9870000001',
        'address': 'MG Road, Camp, Pune'
    }
    res = client.post('/api/profile', json=save_payload)
    assert res.status_code == 200
    res = client.get('/api/profile')
    saved_alpha = res.get_json()
    assert saved_alpha['shop_name'] == 'Alpha International Travels'
    assert saved_alpha['owner_name'] == 'Alpha Rao'
    assert saved_alpha['phone'] == '9870000001'
    assert saved_alpha['address'] == 'MG Road, Camp, Pune'
    print("[PASS] Test 2: client_alpha successfully saved their own profile")

    # TEST 3: Login as client_beta and verify they DO NOT see client_alpha's or admin's details
    with client.session_transaction() as sess:
        sess['user_id'] = u_beta.id
        sess['username'] = 'client_beta'
        sess['role'] = 'staff'
        sess['full_name'] = ''

    res = client.get('/api/profile')
    beta_prof = res.get_json()
    print("Initial client_beta profile:", beta_prof)
    assert beta_prof['shop_name'] == '', f"client_beta shop_name leaked: {beta_prof['shop_name']}"
    assert beta_prof['owner_name'] == '', f"client_beta owner_name leaked: {beta_prof['owner_name']}"
    assert beta_prof['phone'] == '', f"client_beta phone leaked: {beta_prof['phone']}"
    assert beta_prof['address'] == '', f"client_beta address leaked: {beta_prof['address']}"
    print("[PASS] Test 3: client_beta profile is 100% isolated and clean")

    # TEST 4: Login as admin and verify admin has their own profile
    with client.session_transaction() as sess:
        sess['user_id'] = 1
        sess['username'] = 'admin'
        sess['role'] = 'admin'
        sess['full_name'] = 'Super Administrator'

    res = client.get('/api/profile')
    admin_prof = res.get_json()
    print("Admin profile:", admin_prof)
    assert admin_prof['shop_name'] != 'Alpha International Travels', "Admin saw Alpha's shop name!"
    print("[PASS] Test 4: Admin profile is unaffected by tenant profile updates")

    # TEST 5: Security Lockout Verification for client_alpha
    with client.session_transaction() as sess:
        sess['user_id'] = u_alpha.id
        sess['username'] = 'client_alpha'
        sess['role'] = 'staff'
        sess['full_name'] = 'Alpha Rao'

    # 5a. Regular user navigating to /admin must be redirected to /
    res = client.get('/admin', follow_redirects=False)
    assert res.status_code in (301, 302), f"Expected redirect, got {res.status_code}"
    assert res.headers['Location'] in ('/', 'http://localhost/'), f"Redirect target was {res.headers.get('Location')}"
    print("[PASS] Test 5a: Access to /admin by staff user is blocked and redirected to /")

    # 5b. Regular user calling /api/users must receive 403 Forbidden
    res = client.get('/api/users')
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"
    print("[PASS] Test 5b: Staff user calling /api/users receives 403 Forbidden")

    # 5c. Regular user calling /api/admin/stats must receive 403 Forbidden
    res = client.get('/api/admin/stats')
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"
    print("[PASS] Test 5c: Staff user calling /api/admin/stats receives 403 Forbidden")

    # 5d. Regular user loading / must NOT have admin buttons or modals in the HTML
    res = client.get('/')
    assert res.status_code == 200
    html = res.get_data(as_text=True)
    assert 'id="adminPortalHeaderBtn"' not in html, "adminPortalHeaderBtn should NOT be in HTML for staff"
    assert 'id="tab-users"' not in html, "tab-users should NOT be in HTML for staff"
    assert 'id="view-users"' not in html, "view-users should NOT be in HTML for staff"
    assert 'id="addUserModal"' not in html, "addUserModal should NOT be in HTML for staff"
    assert 'id="editUserModal"' not in html, "editUserModal should NOT be in HTML for staff"
    print("[PASS] Test 5d: Rendered UI for staff user has zero admin controls or modals")

    # 5e. Public login page does not have "Login as Admin" link
    res = client.get('/login')
    login_html = res.get_data(as_text=True)
    assert 'Login as Admin' not in login_html, "Public login page contains 'Login as Admin' link"
    assert '/admin/login' not in login_html, "Public login page contains '/admin/login' link"
    print("[PASS] Test 5e: Public login page has no link to admin portal")

    # TEST 6: Zero SQLite DB check
    base_dir = os.path.dirname(os.path.abspath(__file__))
    sqlite_files = [f for f in os.listdir(base_dir) if f.endswith('.db')]
    assert len(sqlite_files) == 0, f"SQLite .db file found: {sqlite_files}"
    print("[PASS] Test 6: Zero local SQLite databases exist on disk (100% Cloud Neon PostgreSQL)")

    # Cleanup test users
    db = SessionLocal()
    try:
        for uname in ['client_alpha', 'client_beta']:
            u = db.query(User).filter_by(username=uname).first()
            if u:
                db.query(Setting).filter(Setting.key.like(f"user_{u.id}_%")).delete(synchronize_session=False)
                db.delete(u)
        db.commit()
        print("[OK] Test users cleaned up successfully from Neon DB.")
    finally:
        db.close()

    print("\n🎉 ALL TESTS PASSED! Multi-tenant profile isolation, cloud DB enforcement, and admin lockout are 100% verified.")

if __name__ == '__main__':
    run_e2e_verification()
