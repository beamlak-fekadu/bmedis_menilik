import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

type MailAddress = string | { name: string; address: string };

export interface SendMailInput {
  to: MailAddress | MailAddress[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: MailAddress;
}

function readEnv(name: string) {
  return process.env[name]?.trim() ?? '';
}

export function isSmtpConfigured() {
  return Boolean(readEnv('SMTP_HOST'));
}

function readPort() {
  const raw = readEnv('SMTP_PORT');
  if (!raw) return 587;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 587;
}

function readSecure(port: number) {
  const explicit = readEnv('SMTP_SECURE').toLowerCase();
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;
  return port === 465;
}

function createTransportOptions(): SMTPTransport.Options {
  const host = readEnv('SMTP_HOST');
  const user = readEnv('SMTP_USER');
  const pass = readEnv('SMTP_PASSWORD') || readEnv('SMTP_PASS');
  const port = readPort();

  if (!host) {
    throw new Error('SMTP_HOST is not configured.');
  }

  return {
    host,
    port,
    secure: readSecure(port),
    auth: user && pass ? { user, pass } : undefined,
  };
}

export function getDefaultMailFrom(): string {
  const from = readEnv('SMTP_FROM') || readEnv('SMTP_USER');
  if (!from) {
    throw new Error('SMTP_FROM or SMTP_USER is required for outgoing email.');
  }
  return from;
}

export async function sendMail(input: SendMailInput) {
  const transport = nodemailer.createTransport(createTransportOptions());
  return transport.sendMail({
    from: getDefaultMailFrom(),
    ...input,
  });
}
