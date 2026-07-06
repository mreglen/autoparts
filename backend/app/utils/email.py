import secrets
import ssl
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib
from app.core.config import Settings

logger = logging.getLogger(__name__)

# Re-export functions for external use
__all__ = [
    "generate_verification_code",
    "send_verification_email",
    "send_seller_application_confirmation",
    "send_welcome_email",
    "send_notification_email",
]

settings = Settings()


def _send_plain_email(to: str, subject: str, body: str) -> bool:
    msg = MIMEMultipart()
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    try:
        if settings.EMAIL_PORT == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(
                settings.EMAIL_HOST,
                settings.EMAIL_PORT,
                context=context,
                timeout=10,
            ) as server:
                server.login(settings.EMAIL_HOST_USER, settings.EMAIL_HOST_PASSWORD)
                server.send_message(msg)
                return True

        if settings.EMAIL_PORT in [587, 25, 2525]:
            with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT, timeout=10) as server:
                server.starttls(context=ssl.create_default_context())
                server.login(settings.EMAIL_HOST_USER, settings.EMAIL_HOST_PASSWORD)
                server.send_message(msg)
                return True
    except Exception as exc:
        logger.error(
            "Email sending failed to %s: %s (host=%s port=%s)",
            to,
            exc,
            settings.EMAIL_HOST,
            settings.EMAIL_PORT,
        )
    return False


def send_notification_email(to: str, subject: str, body: str) -> bool:
    """Plain-text transactional notification email."""
    if not to or not to.strip():
        return False
    return _send_plain_email(to.strip(), subject, body)

def generate_verification_code() -> str:
    return secrets.choice("0123456789") + "".join(secrets.choice("0123456789") for _ in range(5))

def send_verification_email(email: str, code: str, subject: str = None, body: str = None):
    email_body = body or f"Ваш код подтверждения: {code}"
    return _send_plain_email(
        email,
        subject or "Подтверждение регистрации",
        email_body,
    )


def send_welcome_email(email: str, full_name: str, login: str, password: str = None, organization_name: str = None):
    """Send welcome email to user after successful registration"""
    subject = "Добро пожаловать! Регистрация завершена"

    if organization_name:
        email_body = f"""Здравствуйте, {full_name}!

Поздравляем! Ваша регистрация как продавца успешно завершена.

Данные вашего аккаунта:
- Логин (email): {login}
- Организация: {organization_name}
- Пароль: {password}

Ваш аккаунт активирован и готов к использованию.

С уважением,
Свой Гараж
https://svoygarage.ru/
    """
    else:
        email_body = f"""Здравствуйте, {full_name}!

Поздравляем! Ваша регистрация успешно завершена.

Данные вашего аккаунта:
- Логин (email): {login}

Ваш аккаунт активирован и готов к использованию.
Войдите в систему, используя указанный email и пароль, который вы создали при регистрации.

С уважением,
Свой Гараж
https://svoygarage.ru/
    """

    return _send_plain_email(email, subject, email_body)


def send_seller_application_confirmation(email: str, full_name: str, organization_name: str):
    """Send confirmation email to seller after application submission"""
    email_body = f"""Здравствуйте, {full_name}!

Вы успешно оставили заявку на регистрацию на сайте как продавец.

Данные вашей заявки:
- Организация: {organization_name}
- Email: {email}

Ваша заявка находится на рассмотрении администратором. После проверки вы получите уведомление о результате модерации.

С уважением,
Свой Гараж
https://svoygarage.ru/
    """
    return _send_plain_email(email, "Заявка на регистрацию продавца отправлена", email_body)