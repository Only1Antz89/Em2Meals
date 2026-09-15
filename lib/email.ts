export class EmailDeliveryUncertain extends Error {}

export type EmailMessage = {
  apiKey: string;
  sender: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
};

type Smtp2GoResponse = {
  request_id?: string;
  data?: {
    succeeded?: number;
    failed?: number;
    failures?: unknown[];
    email_id?: string;
  };
};

export async function sendEmail(message: EmailMessage) {
  let response: Response;
  try {
    response = await fetch("https://eu-api.smtp2go.com/v3/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Smtp2go-Api-Key": message.apiKey,
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
