import re
import datetime
import pandas as pd
import database
from database import Customer
import backup_manager

# Synonyms for column matching (all normalized to lower-case with underscores)
COLUMN_SYNONYMS = {
    'name': ['name', 'customer_name', 'client_name', 'full_name', 'customer', 'नाव', 'ग्राहक_नाव', 'ग्राहकनाव', 'fullname', 'client'],
    'phone': ['phone', 'mobile', 'mobile_no', 'phone_no', 'contact', 'whatsapp', 'मोबाईल', 'फोन', 'contact_no', 'cell', 'संपर्क_क्र', 'whatsapp_no', 'primary_phone', 'primary_mobile', 'phone1', 'mobile1'],
    'phone2': ['phone2', 'mobile2', 'phone_2', 'mobile_2', 'alt_phone', 'alt_mobile', 'alternate_phone', 'alternate_mobile', 'secondary_phone', 'secondary_mobile', 'दुसरा_नंबर', 'दुसरा_फोन', 'पर्यायी_फोन', 'पर्यायी_मोबाईल', 'दुसरा_मोबाईल', 'contact2', 'contact_2', 'alternate_contact', 'other_phone', 'other_mobile'],
    'dob': ['dob', 'birth_date', 'date_of_birth', 'birthdate', 'जन्म_तारीख', 'जन्मतारीख', 'वाढदिवस', 'birthday', 'bday'],
    'passport_no': ['passport', 'passport_no', 'passport_number', 'pass_no', 'पासपोर्ट_नंबर', 'पासपोर्ट_क्र', 'पासपोर्ट'],
    'expiry_date': ['expiry', 'expiry_date', 'passport_expiry', 'valid_till', 'validity', 'exp_date', 'मुदत_संपण्याची_तारीख', 'मुदत'],
    'issue_date': ['issue_date', 'issued_on', 'passport_issue', 'issue', 'तारीख', 'जारी_तारीख'],
    'city': ['city', 'location', 'address', 'गाव', 'शहर', 'पत्ता', 'area', 'town'],
    'notes': ['notes', 'remarks', 'remark', 'शेरा', 'comment']
}

def clean_column_name(col):
    if not isinstance(col, str):
        return ''
    c = col.strip().lower()
    # Strip common punctuation while preserving all Unicode (Marathi/English) letters & numbers
    c = re.sub(r'[\s\-_\./\\()\[\]{}*+!?:;\'"]+', '_', c)
    return c.strip('_')

def detect_columns(df_columns):
    """
    Auto-detects mapping from dataframe columns to standard customer fields.
    """
    mapping = {}
    normalized_cols = {col: clean_column_name(str(col)) for col in df_columns}

    for std_field, synonyms in COLUMN_SYNONYMS.items():
        matched = False
        for original_col, norm_col in normalized_cols.items():
            if norm_col in synonyms:
                mapping[std_field] = original_col
                matched = True
                break
        if not matched:
            # Fuzzy match (substring)
            for original_col, norm_col in normalized_cols.items():
                if any(syn in norm_col for syn in synonyms):
                    mapping[std_field] = original_col
                    break
    return mapping

def parse_date(val):
    """
    Safely parses various date formats into YYYY-MM-DD.
    Handles Excel timestamps, strings like '15/08/1990', '1990-08-15', etc.
    """
    if pd.isna(val) or val is None or str(val).strip() == '':
        return ''
    
    if isinstance(val, (datetime.datetime, datetime.date, pd.Timestamp)):
        return val.strftime('%Y-%m-%d')
    
    s = str(val).strip()
    # Check common date patterns
    for fmt in ('%d/%m/%Y', '%d-%m-%Y', '%Y-%m-%d', '%Y/%m/%d', '%d.%m.%Y', '%d/%m/%y', '%d-%m-%y'):
        try:
            dt = datetime.datetime.strptime(s, fmt)
            # Normalize 2-digit years
            if dt.year < 1920:
                dt = dt.replace(year=dt.year + 100)
            return dt.strftime('%Y-%m-%d')
        except ValueError:
            pass

    # Try pandas to_datetime as fallback
    try:
        dt = pd.to_datetime(s, errors='coerce', dayfirst=True)
        if not pd.isna(dt):
            return dt.strftime('%Y-%m-%d')
    except Exception:
        pass

    return ''

def clean_phone(val):
    """
    Normalizes phone number to 10-digit base and 91 prefixed international format.
    E.g. '+91 98220-12345' -> '919822012345'
    """
    if pd.isna(val) or val is None:
        return ''
    
    s = str(val).split('.')[0].strip() # Handle float from excel e.g. 9822012345.0
    digits = re.sub(r'\D', '', s)

    if len(digits) == 10:
        return f"91{digits}"
    elif len(digits) == 11 and digits.startswith('0'):
        return f"91{digits[1:]}"
    elif len(digits) == 12 and digits.startswith('91'):
        return digits
    elif len(digits) >= 10:
        # Take rightmost 10 digits
        return f"91{digits[-10:]}"
    return ''

def process_excel_file(file_path_or_buffer, mode='append_new', custom_mapping=None, user_id=None):
    """
    Reads an Excel (.xlsx, .xls) or CSV file, applies mapping, creates an auto-snapshot,
    and imports/appends customers.
    mode: 'append_new' (default: skip existing), 'update_existing' (update details), 'replace'
    """
    # 1. Read file into DataFrame
    try:
        if isinstance(file_path_or_buffer, str) and file_path_or_buffer.lower().endswith('.csv'):
            df = pd.read_csv(file_path_or_buffer)
        else:
            # Excel
            df = pd.read_excel(file_path_or_buffer)
    except Exception as e:
        return {'status': 'error', 'message': f'Error reading file: {str(e)}'}

    if df.empty:
        return {'status': 'error', 'message': 'The uploaded Excel file is empty.'}

    # 2. Column mapping
    mapping = custom_mapping or detect_columns(df.columns)
    if 'phone' not in mapping or 'name' not in mapping:
        return {
            'status': 'error',
            'message': 'Could not find required Name and Phone/Mobile columns in the Excel sheet.',
            'detected_columns': list(df.columns),
            'mapping': mapping
        }

    # 3. Create safety auto-snapshot before importing!
    try:
        backup_manager.create_backup(backup_type='auto_pre_import', user_id=user_id)
    except Exception as e:
        print(f"Warning: Pre-import snapshot failed: {e}")

    # 4. Open DB Session
    session = database.SessionLocal()
    try:
        if mode == 'replace':
            if user_id is not None:
                session.query(Customer).filter(Customer.created_by_user_id == user_id).delete()
            else:
                session.query(Customer).delete()
            session.commit()

        # Cache existing customers for fast in-memory lookup — SCOPED TO THIS USER/SHOP ONLY!
        query_exist = session.query(Customer)
        if user_id is not None:
            query_exist = query_exist.filter(Customer.created_by_user_id == user_id)

        existing_phones = {c.phone: c for c in query_exist.all()}
        existing_passports = {c.passport_no: c for c in query_exist.filter(Customer.passport_no != '').all()}

        total_rows = len(df)
        added_count = 0
        updated_count = 0
        skipped_count = 0
        error_rows = 0

        batch_new = []

        for idx, row in df.iterrows():
            name_val = str(row.get(mapping.get('name', ''), '')).strip()
            phone_raw = row.get(mapping.get('phone', ''), '')
            phone_val = clean_phone(phone_raw)

            if not phone_val or not name_val or name_val.lower() == 'nan':
                error_rows += 1
                continue

            phone2_raw = row.get(mapping.get('phone2', ''), '') if 'phone2' in mapping else ''
            phone2_val = clean_phone(phone2_raw) if phone2_raw else ''

            dob_val = parse_date(row.get(mapping.get('dob', ''), '')) if 'dob' in mapping else ''
            passport_val = str(row.get(mapping.get('passport_no', ''), '')).strip() if 'passport_no' in mapping else ''
            if passport_val.lower() == 'nan':
                passport_val = ''
            
            exp_val = parse_date(row.get(mapping.get('expiry_date', ''), '')) if 'expiry_date' in mapping else ''
            issue_val = parse_date(row.get(mapping.get('issue_date', ''), '')) if 'issue_date' in mapping else ''
            city_val = str(row.get(mapping.get('city', ''), '')).strip() if 'city' in mapping else ''
            if city_val.lower() == 'nan':
                city_val = ''
            notes_val = str(row.get(mapping.get('notes', ''), '')).strip() if 'notes' in mapping else ''
            if notes_val.lower() == 'nan':
                notes_val = ''

            # Duplicate check
            existing = existing_phones.get(phone_val)
            if not existing and passport_val and passport_val in existing_passports:
                existing = existing_passports.get(passport_val)

            if existing:
                if mode == 'update_existing':
                    if name_val: existing.name = name_val
                    if phone2_val: existing.phone2 = phone2_val
                    if dob_val: existing.dob = dob_val
                    if passport_val: existing.passport_no = passport_val
                    if exp_val: existing.expiry_date = exp_val
                    if issue_val: existing.issue_date = issue_val
                    if city_val: existing.city = city_val
                    if notes_val: existing.notes = notes_val
                    updated_count += 1
                else: # append_new
                    skipped_count += 1
            else:
                new_c = Customer(
                    name=name_val,
                    phone=phone_val,
                    phone2=phone2_val,
                    dob=dob_val,
                    passport_no=passport_val,
                    expiry_date=exp_val,
                    issue_date=issue_val,
                    city=city_val,
                    notes=notes_val,
                    created_by_user_id=user_id
                )
                batch_new.append(new_c)
                existing_phones[phone_val] = new_c
                if passport_val:
                    existing_passports[passport_val] = new_c
                added_count += 1

                # Flush in chunks of 500 for high performance
                if len(batch_new) >= 500:
                    session.bulk_save_objects(batch_new)
                    session.commit()
                    batch_new = []

        if batch_new:
            session.bulk_save_objects(batch_new)
            session.commit()

        if mode == 'update_existing':
            session.commit()

        total_customers = session.query(Customer).count()

        return {
            'status': 'success',
            'total_rows': total_rows,
            'added': added_count,
            'updated': updated_count,
            'skipped_duplicates': skipped_count,
            'invalid_rows': error_rows,
            'current_total_customers': total_customers,
            'mapping_used': mapping
        }

    except Exception as e:
        session.rollback()
        return {'status': 'error', 'message': f'Import error: {str(e)}'}
    finally:
        session.close()

def get_preview_data(file_path_or_buffer):
    """
    Returns column names, detected mappings, and the first 5 rows for UI preview before import.
    """
    try:
        if isinstance(file_path_or_buffer, str) and file_path_or_buffer.lower().endswith('.csv'):
            df = pd.read_csv(file_path_or_buffer, nrows=5)
        else:
            df = pd.read_excel(file_path_or_buffer, nrows=5)

        columns = list(df.columns)
        mapping = detect_columns(columns)
        
        # Format rows as clean json dicts
        rows = df.fillna('').to_dict(orient='records')
        return {
            'status': 'success',
            'columns': columns,
            'detected_mapping': mapping,
            'preview_rows': rows
        }
    except Exception as e:
        return {'status': 'error', 'message': str(e)}
