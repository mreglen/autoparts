import secrets
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib
from app.core.config import Settings

settings = Settings()

def generate_verification_code() -> str:
    return secrets.choice("0123456789") + "".join(secrets.choice("0123456789") for _ in range(5))

def send_verification_email(email: str, code: str):
    msg = MIMEMultipart()
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = email
    msg["Subject"] = "Подтверждение регистрации"
    body = f"Ваш код подтверждения: {code}"
    msg.attach(MIMEText(body, "plain"))

    with smtplib.SMTP_SSL(settings.EMAIL_HOST, settings.EMAIL_PORT) as server:
        server.login(settings.EMAIL_HOST_USER, settings.EMAIL_HOST_PASSWORD)
        server.send_message(msg)