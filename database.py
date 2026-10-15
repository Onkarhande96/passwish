import os
import datetime
from dotenv import load_dotenv

# Explicitly load .env from the application directory
base_dir = os.path.dirname(os.path.abspath(__file__))
env_file = os.path.join(base_dir, '.env')
if os.path.exists(env_file):
    load_dotenv(env_file)
else:
    load_dotenv()

from sqlalchemy import (
    create_engine, Column, Integer, String, Text, DateTime, Boolean, Index, text
)
from sqlalchemy.orm import declarative_base, sessionmaker, scoped_session
from werkzeug.security import generate_password_hash, check_password_hash

Base = declarative_base()

class Customer(Base):
    __tablename__ = 'customers'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    phone = Column(String(30), nullable=False, index=True)
    phone2 = Column(String(30), nullable=True) # Alternate/Secondary Mobile Number (Optional)
    dob = Column(String(20), index=True)  # Stored as YYYY-MM-DD
    passport_no = Column(String(50), index=True)
    issue_date = Column(String(20))       # YYYY-MM-DD
    expiry_date = Column(String(20), index=True) # YYYY-MM-DD
    city = Column(String(100))
    notes = Column(Text)
    whatsapp_status = Column(String(30), default='active', index=True) # 'active', 'no_whatsapp', 'invalid'
    service_status = Column(String(50), default='New', index=True) # 'New', 'Alert Sent', 'In Discussion', 'Docs Collected', 'Appointment / Applied', 'Passport Delivered', 'Not Interested'
    created_by_user_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'phone': self.phone,
            'phone2': self.phone2 or '',
            'dob': self.dob or '',
            'passport_no': self.passport_no or '',
            'issue_date': self.issue_date or '',
            'expiry_date': self.expiry_date or '',
            'city': self.city or '',
            'notes': self.notes or '',
            'whatsapp_status': self.whatsapp_status or 'active',
            'service_status': self.service_status or 'New',
            'created_by_user_id': self.created_by_user_id,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else '',
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else ''
        }

class MessageTemplate(Base):
    __tablename__ = 'message_templates'

    id = Column(Integer, primary_key=True, autoincrement=True)
    category = Column(String(50), nullable=False, index=True) # birthday, diwali, festival, expiry, general
    name = Column(String(100), nullable=False)
    body = Column(Text, nullable=False)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'category': self.category,
            'name': self.name,
            'body': self.body,
            'is_default': bool(self.is_default),
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else ''
        }

class SentLog(Base):
    __tablename__ = 'sent_logs'

    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(Integer, nullable=True)
    customer_name = Column(String(200), nullable=True)
    phone = Column(String(30), nullable=False)
    message_type = Column(String(50)) # birthday, festival, expiry, custom
    message_content = Column(Text)
    sent_by_user_id = Column(Integer, nullable=True)
    sent_at = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String(30), default='sent') # sent, clicked, failed

    def to_dict(self):
        return {
            'id': self.id,
            'customer_id': self.customer_id,
            'customer_name': self.customer_name or '',
            'phone': self.phone,
            'message_type': self.message_type,
            'message_content': self.message_content,
            'sent_by_user_id': self.sent_by_user_id,
            'sent_at': self.sent_at.strftime('%Y-%m-%d %H:%M:%S') if self.sent_at else '',
            'status': self.status
        }

class Setting(Base):
    __tablename__ = 'settings'

    key = Column(String(100), primary_key=True)
    value = Column(Text)

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(200), default='')
    agency_name = Column(String(200), default='')
    role = Column(String(50), default='staff')  # 'admin' or 'staff'
    phone = Column(String(30), default='')
    valid_until = Column(String(30), nullable=True) # YYYY-MM-DD or None (unlimited/lifetime)
    max_customers = Column(Integer, default=25000)
    notes = Column(Text, default='')
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def get_license_info(self):
        """Calculates license status and remaining days."""
        if self.role == 'admin':
            return {
                'status': 'lifetime',
                'status_label': 'Lifetime Super Admin',
                'days_left': None,
                'is_expired': False,
                'badge_class': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
            }
        
        if not self.valid_until:
            return {
                'status': 'lifetime',
                'status_label': 'Unlimited / Lifetime',
                'days_left': None,
                'is_expired': False,
                'badge_class': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
            }

        try:
            exp_date = datetime.datetime.strptime(self.valid_until.strip(), '%Y-%m-%d').date()
            today = datetime.date.today()
            delta = (exp_date - today).days

            if delta < 0:
                return {
                    'status': 'expired',
                    'status_label': f'Expired ({abs(delta)} days ago)',
                    'days_left': delta,
                    'is_expired': True,
                    'badge_class': 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                }
            elif delta <= 7:
                return {
                    'status': 'expiring_soon',
                    'status_label': f'{delta} Days Left',
                    'days_left': delta,
                    'is_expired': False,
                    'badge_class': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                }
            else:
                return {
                    'status': 'active',
                    'status_label': f'{delta} Days Left (Till {self.valid_until})',
                    'days_left': delta,
                    'is_expired': False,
                    'badge_class': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                }
        except Exception:
            return {
                'status': 'custom',
                'status_label': self.valid_until,
                'days_left': None,
                'is_expired': False,
                'badge_class': 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
            }

    def to_dict(self):
        lic = self.get_license_info()
        return {
            'id': self.id,
            'username': self.username,
            'full_name': self.full_name or '',
            'agency_name': self.agency_name or '',
            'role': self.role or 'staff',
            'phone': self.phone or '',
            'valid_until': self.valid_until or '',
            'max_customers': self.max_customers or 25000,
            'notes': self.notes or '',
            'is_active': bool(self.is_active),
            'license_status': lic['status'],
            'license_label': lic['status_label'],
            'license_days_left': lic['days_left'],
            'is_expired': lic['is_expired'],
            'license_badge_class': lic['badge_class'],
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else ''
        }

class BackupLog(Base):
    __tablename__ = 'backup_logs'

    id = Column(Integer, primary_key=True, autoincrement=True)
    filename = Column(String(255), nullable=False)
    backup_type = Column(String(50)) # manual_export, auto_pre_import
    customer_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'backup_type': self.backup_type,
            'customer_count': self.customer_count,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else ''
        }

NEON_FALLBACK_URL = "postgresql://neondb_owner:npg_CtjLKck9zGh8@ep-wild-hat-b5svo1p0-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Database engine & session
def get_db_url():
    url = os.environ.get('DATABASE_URL')
    if not url:
        print("[PassWish] Using configured Neon Cloud PostgreSQL database.", flush=True)
        url = NEON_FALLBACK_URL
    
    # Normalize Postgres URL for modern SQLAlchemy (Render/Supabase use postgres://)
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url

DB_URL = get_db_url()
is_sqlite = False

engine = create_engine(DB_URL, pool_size=10, max_overflow=20, pool_pre_ping=True, pool_recycle=300)

SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))

def init_db():
    Base.metadata.create_all(bind=engine)
    
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone2 VARCHAR(30) NULL"))
            conn.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS whatsapp_status VARCHAR(30) DEFAULT 'active'"))
            conn.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS service_status VARCHAR(50) DEFAULT 'New'"))
            conn.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS agency_name VARCHAR(200) DEFAULT ''"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS valid_until VARCHAR(30) NULL"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS max_customers INTEGER DEFAULT 25000"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT ''"))
            conn.execute(text("ALTER TABLE sent_logs ADD COLUMN IF NOT EXISTS sent_by_user_id INTEGER"))
            conn.commit()
    except Exception as e:
        print(f"Postgres migration note: {e}")

    session = SessionLocal()
    try:
        # Default Admin User
        admin_user = session.query(User).filter_by(username='admin').first()
        if not admin_user:
            admin_user = User(
                username='admin',
                full_name='Super Administrator',
                role='admin',
                phone='9876543210',
                is_active=True
            )
            admin_user.set_password('admin123')
            session.add(admin_user)
        else:
            # Ensure admin has role 'admin'
            if not admin_user.role or admin_user.role != 'admin':
                admin_user.role = 'admin'
            if not admin_user.full_name:
                admin_user.full_name = 'Super Administrator'
            admin_user.is_active = True

        # Default Settings
        default_settings = {
            'shop_name': 'Global Passport & Visa Consultancy',
            'owner_name': 'Santosh Patil',
            'phone': '9876543210',
            'city': 'Pune',
            'address': 'Shop No. 12, City Center Mall, Near Bus Stand',
            'whatsapp_mode': 'web',
            'reminder_enabled': 'true',
            'reminder_time': '10:00'
        }
        for k, v in default_settings.items():
            if not session.query(Setting).filter_by(key=k).first():
                session.add(Setting(key=k, value=v))

        # Default Templates
        if session.query(MessageTemplate).count() == 0:
            templates = [
                # Birthday Templates (English & Marathi)
                MessageTemplate(
                    category='birthday',
                    name='वाढदिवस शुभेच्छा (Marathi Formal)',
                    body='प्रिय {name} जी, तुम्हाला वाढदिवसाच्या हार्दिक शुभेच्छा! 🎂🎉 हे येणारे नवीन वर्ष तुम्हाला उत्तम आरोग्य, दीर्घायुष्य, सुख, शांती आणि भरभराट घेऊन येवो हीच सदिच्छा.\n\n- {shop_name}\n📞 {shop_phone}',
                    is_default=True
                ),
                MessageTemplate(
                    category='birthday',
                    name='Birthday Wishes (English Standard)',
                    body='Dear {name}, wishing you a very Happy Birthday! 🎂✨ May your special day bring you joy, happiness, and continued success. Have a wonderful year ahead!\n\nWarm regards,\n{shop_name}\n📞 {shop_phone}',
                    is_default=False
                ),
                # Diwali Templates
                MessageTemplate(
                    category='diwali',
                    name='दिवाळी सस्नेह शुभेच्छा (Marathi)',
                    body='सस्नेह नमस्कार {name} जी,\n\nदीपावलीच्या आणि नवीन वर्षाच्या तुम्हाला व तुमच्या संपूर्ण परिवारास मनःपूर्वक हार्दिक शुभेच्छा! 🪔✨\n\nदीपावलीच्या या मंगलमयी दीपोत्सवात आपले जीवन सुख, समृद्धी, उत्तम आरोग्य आणि भरभराटीने उजळून निघो हीच प्रार्थना.\n\nशुभ दीपावली! 🪔🎆\n- {shop_name}\n📞 {shop_phone}',
                    is_default=True
                ),
                MessageTemplate(
                    category='diwali',
                    name='Happy Diwali & New Year (English)',
                    body='Dear {name},\n\nWishing you and your family a very Happy and Prosperous Diwali! 🪔✨ May the festival of lights illuminate your life with joy, health, wealth, and success.\n\nWarm wishes,\n{shop_name}\n📞 {shop_phone}',
                    is_default=False
                ),
                # Festival General
                MessageTemplate(
                    category='festival',
                    name='सण व उत्सवाच्या हार्दिक शुभेच्छा (General)',
                    body='नमस्कार {name} जी, {festival_name} निमित्त तुम्हाला आणि तुमच्या कुटुंबीयांना हार्दिक मंगलमय शुभेच्छा! 🌸✨\n\n- {shop_name}\n📞 {shop_phone}',
                    is_default=True
                ),
                # Passport Expiry Reminder (Huge value for Passport Shop)
                MessageTemplate(
                    category='expiry',
                    name='पासपोर्ट रिन्यूअल अलर्ट (मराठी)',
                    body='नमस्कार {name} जी,\n\nतुमच्या पासपोर्टची मुदत ({expiry_date}) लवकरच संपत येत आहे. आंतरराष्ट्रीय प्रवासासाठी पासपोर्ट किमान ६ महिने वैध असणे बंधनकारक असते.\n\nवेळेवर पासपोर्ट नूतनीकरण (Renewal) करण्यासाठी आजच आमच्याशी संपर्क साधा किंवा कागदपत्रांसह शॉपला भेट द्या.\n\n- {shop_name}\nपत्ता: {shop_address}\n📞 {shop_phone}',
                    is_default=True
                ),
                MessageTemplate(
                    category='expiry',
                    name='Passport Renewal Reminder (English)',
                    body='Dear {name},\n\nThis is a friendly reminder that your passport (valid till: {expiry_date}) is nearing its expiry date. Most international airlines and visas require at least 6 months validity.\n\nTo ensure smooth travel, please renew your passport promptly. Contact us for hassle-free renewal assistance!\n\n- {shop_name}\n📞 {shop_phone}',
                    is_default=False
                )
            ]
            session.add_all(templates)
        session.commit()
    except Exception as e:
        session.rollback()
        print(f"Error in init_db: {e}")
    finally:
        session.close()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
