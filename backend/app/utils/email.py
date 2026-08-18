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
    "send_autoservice_guest_account_email",
]

settings = Settings()


def _send_plain_email(to: str, subject: str, body: str) -> bool:
    msg = MIMEMultipart()
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    return _deliver_email(msg, to)


def _send_multipart_email(to: str, subject: str, plain_body: str, html_body: str) -> bool:
    msg = MIMEMultipart("alternative")
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(plain_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    return _deliver_email(msg, to)


def _deliver_email(msg: MIMEMultipart, to: str) -> bool:
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


def send_autoservice_guest_account_email(
    email: str,
    full_name: str,
    password: str,
    organization_name: str | None = None,
) -> bool:
    """Send credentials for a guest autoservice client converted to a user account."""
    greeting_name = (full_name or "").strip() or "клиент"
    org_line = (
        f"Автосервис: {organization_name}\n\n"
        if organization_name
        else ""
    )
    org_html = (
        f"<p>Автосервис: <strong>{organization_name}</strong></p>"
        if organization_name
        else ""
    )

    plain_body = f"""Здравствуйте, {greeting_name}!

Для вас создан личный кабинет клиента автосервиса.
{org_line}Теперь вы можете просматривать заказ-наряды и записи на обслуживание.

Данные для входа:
- Логин: {email}
- Пароль: {password}

Рекомендуем сменить пароль после первого входа в настройках профиля.

Войти: https://svoygarage.ru/login

С уважением,
команда Свой Гараж
https://svoygarage.ru/
"""

    html_body = f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Личный кабинет клиента</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Georgia,'Times New Roman',serif;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 20px;border-bottom:2px solid #4f46e5;">
              <div style="font-size:20px;font-weight:600;color:#4f46e5;letter-spacing:0.02em;">Свой Гараж</div>
              <div style="margin-top:6px;font-size:13px;color:#6b7280;">Личный кабинет клиента автосервиса</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;line-height:1.65;font-size:15px;">
              <p style="margin:0 0 16px;">Здравствуйте, {greeting_name}!</p>
              <p style="margin:0 0 16px;">Для вас создан личный кабинет. Теперь вы можете просматривать заказ-наряды и записи на обслуживание.</p>
              {org_html}
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;">Логин</div>
                    <div style="margin-top:4px;font-size:16px;font-weight:600;font-family:ui-monospace,Consolas,monospace;">{email}</div>
                    <div style="margin-top:14px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;">Пароль</div>
                    <div style="margin-top:4px;font-size:16px;font-weight:600;font-family:ui-monospace,Consolas,monospace;">{password}</div>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px;">Рекомендуем сменить пароль после первого входа в настройках профиля.</p>
              <p style="margin:0;">
                <a href="https://svoygarage.ru/login" style="display:inline-block;padding:10px 18px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Войти на сайт</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 24px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280;line-height:1.5;">
              С уважением,<br>команда Свой Гараж<br>
              <a href="https://svoygarage.ru/" style="color:#4f46e5;">svoygarage.ru</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    return _send_multipart_email(
        email,
        "Доступ к личному кабинету клиента",
        plain_body,
        html_body,
    )