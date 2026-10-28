export function maytapiConfig() {
  const productId = (process.env.MAYTAPI_PRODUCT_ID ?? "").trim();
  const token = (process.env.MAYTAPI_TOKEN ?? "").trim();
  const phoneId = (process.env.MAYTAPI_PHONE_ID ?? "").trim();
  return {
    productId,
    token,
    phoneId,
    configured: Boolean(productId && token && phoneId),
  };
}

type MaytapiSendResult = {
  phone: string;
  ok: boolean;
  error?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendWhatsAppText(to: string, message: string): Promise<MaytapiSendResult> {
  const { productId, token, phoneId, configured } = maytapiConfig();
  if (!configured) {
    return { phone: to, ok: false, error: "WhatsApp is not configured." };
  }

  const url = `https://api.maytapi.com/api/${productId}/${phoneId}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-maytapi-key": token,
      },
      body: JSON.stringify({
        to_number: to,
        type: "text",
        message,
      }),
      signal: AbortSignal.timeout(20000),
    });
    const json = (await response.json().catch(() => null)) as
      | { success?: boolean; message?: string; error?: string }
      | null;
    if (!response.ok || json?.success === false) {
      return {
        phone: to,
        ok: false,
        error: json?.message || json?.error || `Maytapi ${response.status}`,
      };
    }
    return { phone: to, ok: true };
  } catch (error) {
    return {
      phone: to,
      ok: false,
      error: error instanceof Error ? error.message : "Could not reach Maytapi.",
    };
  }
}

export async function sendWhatsAppToMany(phones: string[], message: string) {
  const results: MaytapiSendResult[] = [];
  for (let i = 0; i < phones.length; i += 1) {
    results.push(await sendWhatsAppText(phones[i], message));
    if (i < phones.length - 1) await sleep(400);
  }
  return results;
}
