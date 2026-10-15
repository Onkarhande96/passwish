import os
import time
import datetime
import threading
import subprocess
import tempfile

_last_reminded_date = ""

def trigger_desktop_notification(title="PassWish Reminder", message="Check today's customer updates!"):
    """
    Triggers a native Windows Tray / Balloon Notification using PowerShell on Windows.
    Gracefully skips on Linux/Cloud containers.
    """
    if os.name != 'nt':
        return

    safe_title = str(title).replace('"', '""').replace("'", "''")
    safe_msg = str(message).replace('"', '""').replace("'", "''")
    
    ps_content = f"""Add-Type -AssemblyName System.Windows.Forms
$n = New-Object System.Windows.Forms.NotifyIcon
$n.Icon = [System.Drawing.SystemIcons]::Information
$n.BalloonTipTitle = "{safe_title}"
$n.BalloonTipText = "{safe_msg}"
$n.Visible = $true
$n.ShowBalloonTip(5000)
Start-Sleep -Seconds 1
$n.Dispose()
"""
    tmp_path = os.path.join(tempfile.gettempdir(), f"_pw_notify_{int(time.time()*1000)}.ps1")
    try:
        with open(tmp_path, "w", encoding="utf-8") as f:
            f.write(ps_content)
        subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", tmp_path],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=0x08000000) # CREATE_NO_WINDOW
    except Exception as e:
        print(f"[Reminder] Notification error: {e}")
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass

def reminder_worker(session_factory, customer_cls, setting_cls):
    global _last_reminded_date
    while True:
        try:
            now = datetime.datetime.now()
            current_hm = now.strftime('%H:%M')
            today_str = now.strftime('%Y-%m-%d')
            today_md = now.strftime('%m-%d')

            db = session_factory()
            try:
                stg_enabled = db.query(setting_cls).filter_by(key='reminder_enabled').first()
                enabled = (stg_enabled.value.lower() == 'true') if stg_enabled else True

                stg_time = db.query(setting_cls).filter_by(key='reminder_time').first()
                target_time = stg_time.value.strip() if stg_time and stg_time.value else '10:00'

                if enabled and current_hm == target_time and _last_reminded_date != today_str:
                    _last_reminded_date = today_str

                    # Count today's birthdays
                    bday_count = db.query(customer_cls).filter(customer_cls.dob.like(f"%-{today_md}")).count()

                    # Count expiries in next 6 months
                    six_mo = (datetime.date.today() + datetime.timedelta(days=180)).strftime('%Y-%m-%d')
                    exp_count = db.query(customer_cls).filter(
                        customer_cls.expiry_date >= today_str,
                        customer_cls.expiry_date <= six_mo
                    ).count()

                    msg = f"Good morning! Today: {bday_count} Birthdays, {exp_count} Passport Renewals due. Open PassWish to send wishes!"
                    trigger_desktop_notification("PassWish — Daily Morning Reminder", msg)
            finally:
                db.close()
        except Exception as e:
            print(f"[Reminder Daemon] Check error: {e}")

        time.sleep(30)

def start_reminder_daemon(session_factory, customer_cls, setting_cls):
    t = threading.Thread(target=reminder_worker, args=(session_factory, customer_cls, setting_cls), daemon=True)
    t.start()
    return t
