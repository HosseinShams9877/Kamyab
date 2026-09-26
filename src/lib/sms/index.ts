// SMS gateway adapter (B-10 / C-14). A thin, provider-agnostic seam the engine's
// SMS-queue processor calls: it hands over a recipient, a rendered body and the
// configured sender number, and gets back a uniform ok/error result. The three
// supported providers (Kavenegar, Melipayamak, Ghasedak) each speak their own
// REST dialect behind this one interface, so the engine never learns provider
// details. This file makes NO network call on its own — `send()` is invoked only
// when the manager has turned real sending on (settings `sms_real_send`); with it
// off the engine builds and records messages but never reaches a provider.
//
// English-only per policy: this is infrastructure, not UI. Any user-facing text
// (the SMS body itself) is composed upstream from the Persian templates.

/** One outbound message handed to a provider. */
export type SmsSendInput = {
  recipient: string; // customer mobile, 11 digits
  body: string; // already rendered from a Persian template
  senderNumber: string; // the institute's line number at the provider
};

/** Uniform result. `error` carries the provider's message for the FAILED row. */
export type SmsSendResult = { ok: true; providerId?: string } | { ok: false; error: string };

/** What every provider adapter implements. */
export interface SmsGateway {
  readonly provider: string;
  send(input: SmsSendInput): Promise<SmsSendResult>;
}

/** Gateway configuration, read from settings by the caller (never hardcoded). */
export type SmsGatewayConfig = {
  provider: string; // kavenegar | melipayamak | ghasedak
  apiKey: string;
  senderNumber: string;
};

/** Wrap any thrown error (network, JSON, abort) into a FAILED result. */
function toError(err: unknown): SmsSendResult {
  const message = err instanceof Error ? err.message : String(err);
  return { ok: false, error: message };
}

// ---------------------------------------------------------------------------
// Providers. Each maps the uniform input onto the provider's public REST API.
// The exact contracts are best-effort against each vendor's documented endpoint
// and only ever run in production with real credentials; adjust per the account.
// ---------------------------------------------------------------------------

/** Kavenegar — a single GET with the key in the path. */
function kavenegarGateway(config: SmsGatewayConfig): SmsGateway {
  return {
    provider: "kavenegar",
    async send({ recipient, body, senderNumber }) {
      try {
        const url = new URL(
          `https://api.kavenegar.com/v1/${encodeURIComponent(config.apiKey)}/sms/send.json`,
        );
        url.searchParams.set("receptor", recipient);
        url.searchParams.set("sender", senderNumber);
        url.searchParams.set("message", body);
        const res = await fetch(url, { method: "GET" });
        const data = (await res.json().catch(() => null)) as
          | { return?: { status?: number; message?: string } }
          | null;
        const status = data?.return?.status;
        if (res.ok && status === 200) return { ok: true };
        return { ok: false, error: data?.return?.message ?? `HTTP ${res.status}` };
      } catch (err) {
        return toError(err);
      }
    },
  };
}

/** Melipayamak — modern console REST: POST JSON with the key in the path. */
function melipayamakGateway(config: SmsGatewayConfig): SmsGateway {
  return {
    provider: "melipayamak",
    async send({ recipient, body, senderNumber }) {
      try {
        const res = await fetch(
          `https://console.melipayamak.com/api/send/simple/${encodeURIComponent(config.apiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from: senderNumber, to: recipient, text: body }),
          },
        );
        const data = (await res.json().catch(() => null)) as
          | { recId?: string; status?: string }
          | null;
        if (res.ok && data?.recId) return { ok: true, providerId: data.recId };
        return { ok: false, error: data?.status ?? `HTTP ${res.status}` };
      } catch (err) {
        return toError(err);
      }
    },
  };
}

/** Ghasedak — POST form with the key in an `apikey` header. */
function ghasedakGateway(config: SmsGatewayConfig): SmsGateway {
  return {
    provider: "ghasedak",
    async send({ recipient, body, senderNumber }) {
      try {
        const form = new URLSearchParams({
          message: body,
          receptor: recipient,
          linenumber: senderNumber,
        });
        const res = await fetch("https://api.ghasedak.me/v2/sms/send/simple", {
          method: "POST",
          headers: {
            apikey: config.apiKey,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form,
        });
        const data = (await res.json().catch(() => null)) as
          | { result?: { code?: number; message?: string } }
          | null;
        if (res.ok && data?.result?.code === 200) return { ok: true };
        return { ok: false, error: data?.result?.message ?? `HTTP ${res.status}` };
      } catch (err) {
        return toError(err);
      }
    },
  };
}

/** A gateway that refuses to send — used when the provider is unknown or unset,
 *  so a misconfiguration surfaces as a clear FAILED row rather than a silent no-op. */
function unavailableGateway(provider: string): SmsGateway {
  return {
    provider,
    async send() {
      return {
        ok: false,
        error: provider
          ? `سامانه پیامکی «${provider}» پشتیبانی نمی‌شود.`
          : "سامانه پیامکی پیکربندی نشده است.",
      };
    },
  };
}

/** Build the gateway for the configured provider. The caller decides whether to
 *  actually call `send()` (only when real sending is enabled). */
export function createSmsGateway(config: SmsGatewayConfig): SmsGateway {
  switch (config.provider) {
    case "kavenegar":
      return kavenegarGateway(config);
    case "melipayamak":
      return melipayamakGateway(config);
    case "ghasedak":
      return ghasedakGateway(config);
    default:
      return unavailableGateway(config.provider);
  }
}
