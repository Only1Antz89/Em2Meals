export class EmailDeliveryUncertain extends Error {}

// Email goes through Resend when RESEND_API_KEY is set, otherwise SMTP2GO.
export type EmailProvider =
  | { name: "resend"; apiKey: string }
  | { name: "smtp2go"; apiKey: string };

export function emailProvider(c: {
  RESEND_API_KEY?: string;
  SMTP2GO_API_KEY?: string;
}): EmailProvider | null {
  if (c.RESEND_API_KEY) return { name: "resend", apiKey: c.RESEND_API_KEY };
  if (c.SMTP2GO_API_KEY) return { name: "smtp2go", apiKey: c.SMTP2GO_API_KEY };
  return null;
}

export type EmailMessage = {
  provider: EmailProvider;
  sender: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  // Lets the provider drop a repeated request for the same email.
  idempotencyKey?: string;
};

export async function sendEmail(message: EmailMessage) {
  return message.provider.name === "resend"
    ? sendWithResend(message)
    : sendWithSmtp2Go(message);
}

type ResendResponse = { id?: string; message?: string; name?: string };

async function sendWithResend(message: EmailMessage) {
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${message.provider.apiKey}`,
        ...(message.idempotencyKey
          ? { "Idempotency-Key": message.idempotencyKey.slice(0, 256) }
          : {}),
      },
      body: JSON.stringify({
        from: message.sender,
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new EmailDeliveryUncertain("Resend response was not received");
  }
  const result = (await response.json().catch(() => ({}))) as ResendResponse;
  if (!response.ok || !result.id) {
    const detail = result.message ? `: ${result.message.slice(0, 500)}` : "";
    throw Error(`Resend rejected the email (${response.status})${detail}`);
  }
  return { id: result.id, requestId: result.id };
}

type Smtp2GoResponse = {
  request_id?: string;
  data?: {
    succeeded?: number;
    failed?: number;
    failures?: unknown[];
    email_id?: string;
  };
};

async function sendWithSmtp2Go(message: EmailMessage) {
  let response: Response;
  try {
    response = await fetch("https://eu-api.smtp2go.com/v3/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Smtp2go-Api-Key": message.provider.apiKey,
      },
      body: JSON.stringify({
        sender: message.sender,
        to: message.to,
        subject: message.subject,
        text_body: message.text,
        ...(message.html ? { html_body: message.html } : {}),
        fastaccept: false,
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new EmailDeliveryUncertain("SMTP2GO response was not received");
  }
  const result = (await response.json().catch(() => ({}))) as Smtp2GoResponse;
  if (
    !response.ok ||
    (result.data?.failed || 0) > 0 ||
    (result.data?.succeeded ?? 0) < message.to.length
  ) {
    const detail = result.data?.failures?.length
      ? `: ${JSON.stringify(result.data.failures).slice(0, 500)}`
      : "";
    throw Error(`SMTP2GO rejected the email (${response.status})${detail}`);
  }
  return {
    id: result.data?.email_id || result.request_id || "accepted",
    requestId: result.request_id,
  };
}
