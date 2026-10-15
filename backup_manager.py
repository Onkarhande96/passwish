import os
import json
import datetime
import database
from database import Customer, MessageTemplate, SentLog, Setting, BackupLog

BACKUP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backups')
os.makedirs(BACKUP_DIR, exist_ok=True)

def create_backup(backup_type='manual_export', user_id=None):
    """
    Creates a full JSON backup of customers, templates, settings, and logs.
    Scoped to user_id if provided.
    Returns: filepath, total_customers
    """
    session = database.SessionLocal()
    try:
        cust_q = session.query(Customer)
        if user_id is not None:
            cust_q = cust_q.filter(Customer.created_by_user_id == user_id)
        customers = [c.to_dict() for c in cust_q.all()]

        templates = [t.to_dict() for t in session.query(MessageTemplate).all()]
        settings = {s.key: s.value for s in session.query(Setting).all()}

        log_q = session.query(SentLog)
        if user_id is not None:
            log_q = log_q.filter(SentLog.sent_by_user_id == user_id)
        sent_logs = [l.to_dict() for l in log_q.order_by(SentLog.id.desc()).limit(1000).all()]

        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        user_tag = f"_u{user_id}" if user_id else ""
        filename = f"backup_{backup_type}{user_tag}_{timestamp}.json"
        filepath = os.path.join(BACKUP_DIR, filename)

        data = {
            'version': '1.0',
            'exported_at': datetime.datetime.utcnow().isoformat(),
            'backup_type': backup_type,
            'user_id': user_id,
            'summary': {
                'customer_count': len(customers),
                'template_count': len(templates),
                'log_count': len(sent_logs)
            },
            'settings': settings,
            'templates': templates,
            'customers': customers,
            'sent_logs': sent_logs
        }

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        # Log into database
        log_entry = BackupLog(
            filename=filename,
            backup_type=backup_type,
            customer_count=len(customers)
        )
        session.add(log_entry)
        session.commit()

        return filepath, len(customers), filename
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()

def restore_backup(data_dict, mode='merge', user_id=None):
    """
    Restores data from a backup dictionary.
    mode: 'merge' (add new, update existing) or 'replace' (delete existing customers and replace)
    Scoped to user_id.
    """
    session = database.SessionLocal()
    try:
        customers_data = data_dict.get('customers', [])
        templates_data = data_dict.get('templates', [])
        settings_data = data_dict.get('settings', {})

        if mode == 'replace':
            if user_id is not None:
                session.query(Customer).filter(Customer.created_by_user_id == user_id).delete()
            else:
                session.query(Customer).delete()
            session.commit()

        # Existing phone numbers for duplicate handling in merge mode (scoped to user)
        exist_q = session.query(Customer)
        if user_id is not None:
            exist_q = exist_q.filter(Customer.created_by_user_id == user_id)
        existing_customers = {c.phone: c for c in exist_q.all()}

        added = 0
        updated = 0
        skipped = 0

        for c_dict in customers_data:
            phone = str(c_dict.get('phone', '')).strip()
            if not phone:
                continue

            if phone in existing_customers:
                if mode == 'replace':
                    # Will not trigger since table was cleared
                    pass
                else:
                    # Update existing record
                    cust = existing_customers[phone]
                    cust.name = c_dict.get('name', cust.name)
                    cust.phone2 = c_dict.get('phone2', getattr(cust, 'phone2', ''))
                    cust.dob = c_dict.get('dob', cust.dob)
                    cust.passport_no = c_dict.get('passport_no', cust.passport_no)
                    cust.expiry_date = c_dict.get('expiry_date', cust.expiry_date)
                    cust.issue_date = c_dict.get('issue_date', cust.issue_date)
                    cust.city = c_dict.get('city', cust.city)
                    cust.notes = c_dict.get('notes', cust.notes)
                    updated += 1
            else:
                new_cust = Customer(
                    name=c_dict.get('name', 'Unknown'),
                    phone=phone,
                    phone2=c_dict.get('phone2', ''),
                    dob=c_dict.get('dob', ''),
                    passport_no=c_dict.get('passport_no', ''),
                    expiry_date=c_dict.get('expiry_date', ''),
                    issue_date=c_dict.get('issue_date', ''),
                    city=c_dict.get('city', ''),
                    notes=c_dict.get('notes', ''),
                    created_by_user_id=user_id or c_dict.get('created_by_user_id')
                )
                session.add(new_cust)
                existing_customers[phone] = new_cust
                added += 1

        # Restore templates if missing
        for t_dict in templates_data:
            exists = session.query(MessageTemplate).filter_by(name=t_dict.get('name')).first()
            if not exists:
                session.add(MessageTemplate(
                    category=t_dict.get('category', 'general'),
                    name=t_dict.get('name', 'Template'),
                    body=t_dict.get('body', ''),
                    is_default=t_dict.get('is_default', False)
                ))

        # Restore settings
        for k, v in settings_data.items():
            stg = session.query(Setting).filter_by(key=k).first()
            if stg:
                stg.value = str(v)
            else:
                session.add(Setting(key=k, value=str(v)))

        session.commit()
        return {'status': 'success', 'added': added, 'updated': updated, 'total_imported': len(customers_data)}
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()

def list_backups():
    """Returns metadata for all available backups in the backup folder."""
    backups = []
    if not os.path.exists(BACKUP_DIR):
        return backups

    for fname in os.listdir(BACKUP_DIR):
        if fname.endswith('.json'):
            fpath = os.path.join(BACKUP_DIR, fname)
            size_kb = round(os.path.getsize(fpath) / 1024, 2)
            mod_time = datetime.datetime.fromtimestamp(os.path.getmtime(fpath)).strftime('%Y-%m-%d %H:%M:%S')
            
            # Read header summary
            customer_count = 'N/A'
            b_type = 'manual'
            try:
                with open(fpath, 'r', encoding='utf-8') as f:
                    meta = json.load(f)
                    customer_count = meta.get('summary', {}).get('customer_count', 'N/A')
                    b_type = meta.get('backup_type', 'manual')
            except Exception:
                pass

            backups.append({
                'filename': fname,
                'path': fpath,
                'size_kb': size_kb,
                'modified_at': mod_time,
                'customer_count': customer_count,
                'backup_type': b_type
            })

    # Sort newest first
    backups.sort(key=lambda x: x['filename'], reverse=True)
    return backups
