import nodemailer from "nodemailer";
import { logger } from "./logger";

export async function sendMagicLink(to: string, name: string, token: string): Promise<void> {
  const appUrl = process.env.APP_URL ?? "http://localhost:5173";
  const link = `${appUrl}/auth/verify?token=${encodeURIComponent(token)}`;

  if (!process.env.SMTP_HOST) {
    // Dev mode — log the link instead of sending an email
    logger.info({ email: to, link }, "[DEV] Magic link generated (no SMTP_HOST set — email not sent)");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.FROM_EMAIL ?? "noreply@psots.in",
    to,
    subject: "Your PSOTS login link",
    html: `
      <p>Hi ${name},</p>
      <p>Click the link below to log in to PSOTS. It expires in <strong>15 minutes</strong> and can only be used once.</p>
      <p>
        <a href="${link}" style="display:inline-block;background:#1e3a5f;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
          Log in to PSOTS
        </a>
      </p>
      <p style="color:#888;font-size:12px;">Or copy: ${link}</p>
      <p style="color:#888;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
    `,
  });
}
