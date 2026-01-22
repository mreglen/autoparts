import secrets
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib
from app.core.config import Settings

settings = Settings()

def generate_verification_code() -> str:
    return secrets.choice("0123456789") + "".join(secrets.choice("0123456789") for _ in range(5))

def send_verification_email(email: str, code: str, subject: str = None, body: str = None):
    msg = MIMEMultipart()
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = email
    msg["Subject"] = subject or "Подтверждение регистрации"
    email_body = body or f"Ваш код подтверждения: {code}"
    msg.attach(MIMEText(email_body, "plain"))
    
    try:
        # Try primary configuration (port 465 with SSL)
        if settings.EMAIL_PORT == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(settings.EMAIL_HOST, settings.EMAIL_PORT, 
                                context=context, timeout=10) as server:
                server.login(settings.EMAIL_HOST_USER, settings.EMAIL_HOST_PASSWORD)
                server.send_message(msg)
                return True
        
 
        elif settings.EMAIL_PORT in [587, 25, 2525]:
            with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT, timeout=10) as server:
                server.starttls(context=ssl.create_default_context())
                server.login(settings.EMAIL_HOST_USER, settings.EMAIL_HOST_PASSWORD)
                server.send_message(msg)
                return True
                
    except Exception as e:
        print(f"❌ Email sending failed: {e}")
        print(f"🔧 Debug info:")
        print(f"   Host: {settings.EMAIL_HOST}")
        print(f"   Port: {settings.EMAIL_PORT}")
        print(f"   User: {settings.EMAIL_HOST_USER}")
        print(f"   From: {settings.EMAIL_FROM}")
        print(f"   To: {email}")
        return False