import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from app.core.config import settings

logger = logging.getLogger("uvicorn")

def send_otp_email(to_email: str, otp_code: str) -> bool:
    """
    Sends a 6-Digit OTP Email Verification Code directly to the recipient's inbox via Gmail SMTP.
    """
    subject = f"Your FreshSense AI Email Verification Code: {otp_code}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0b1329; color: #ffffff; margin: 0; padding: 20px; }}
            .container {{ max-width: 580px; margin: 0 auto; background: #111c38; border: 1px solid #10b981; border-radius: 16px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
            .brand {{ font-size: 24px; font-weight: 800; color: #10b981; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }}
            .otp-box {{ background: rgba(16, 185, 129, 0.15); border: 2px dashed #10b981; border-radius: 12px; padding: 20px; text-align: center; margin: 25px 0; }}
            .otp-code {{ font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #10b981; font-family: monospace; }}
            .footer {{ font-size: 12px; color: #94a3b8; margin-top: 30px; border-top: 1px solid #1e293b; padding-top: 15px; text-align: center; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="brand">🥬 FreshSense AI Platform</div>
            <h2 style="color: #ffffff; margin-top: 0;">Email Verification Required</h2>
            <p style="color: #cbd5e1; font-size: 15px; line-height: 1.5;">
                Thank you for registering on <strong>FreshSense AI</strong>. Use the following 6-digit OTP verification code to complete your registration:
            </p>
            
            <div class="otp-box">
                <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; margin-bottom: 5px; font-weight: bold;">Your Verification OTP</div>
                <div class="otp-code">{otp_code}</div>
                <div style="font-size: 13px; color: #f59e0b; margin-top: 8px;">⏳ Code expires in 5 minutes</div>
            </div>

            <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
                If you did not request this verification code, please ignore this message.
            </p>

            <div class="footer">
                FreshSense AI • AI-Powered Food Freshness & Supply Chain Engine
            </div>
        </div>
    </body>
    </html>
    """

    smtp_password = settings.SMTP_PASSWORD.replace(" ", "").strip()
    smtp_user = settings.SMTP_USER.strip()

    if not smtp_user or not smtp_password:
        logger.warning(f"[SMTP WARNING] SMTP_USER or SMTP_PASSWORD is empty. Code for {to_email}: {otp_code}")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.EMAILS_FROM_NAME} <{smtp_user}>"
        msg["To"] = to_email

        part = MIMEText(html_content, "html")
        msg.attach(part)

        # Connect to Gmail SMTP server
        if settings.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
            server.starttls()

        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_user, [to_email], msg.as_string())
        server.quit()

        logger.info(f"✅ SMTP Email successfully sent to {to_email} with OTP code {otp_code}")
        return True

    except Exception as e:
        logger.error(f"❌ Failed to send SMTP email to {to_email}: {str(e)}")
        return False
