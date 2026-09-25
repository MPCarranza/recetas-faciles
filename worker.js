const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function productFromEnv(env) {
  return {
    id: env.PRODUCT_ID || "air-fryer-365",
    title: env.PRODUCT_TITLE || "Air Fryer 365 Recetas",
    description:
      env.PRODUCT_DESCRIPTION || "Recetario digital en formato PDF",
    price: Number(env.PRODUCT_PRICE || 17999),
    currency: env.PRODUCT_CURRENCY || "ARS",
  };
}

function publicUrl(request, env, relativePath) {
  const baseUrl = env.APP_BASE_URL || new URL(request.url).origin;
  return new URL(relativePath, `${baseUrl.replace(/\/$/, "")}/`).toString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatCurrency(amount, currency) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function paymentMethodLabel(payment) {
  const labels = {
    account_money: "Dinero disponible en Mercado Pago",
    credit_card: "Tarjeta de crédito",
    debit_card: "Tarjeta de débito",
    prepaid_card: "Tarjeta prepaga",
    bank_transfer: "Transferencia bancaria",
    ticket: "Pago en efectivo",
  };
  return labels[payment.payment_type_id] || payment.payment_method_id || "Mercado Pago";
}

function purchaseEmailHtml(payment, downloadUrl, payerName, product, expirationDays) {
  const safeName = escapeHtml(payerName || "");
  const heading = safeName
    ? `${safeName}, tu compra se realizó con éxito.`
    : "¡Tu compra se realizó con éxito!";
  const safeTitle = escapeHtml(product.title);
  const safePaymentId = escapeHtml(payment.id);
  const safeDownloadUrl = escapeHtml(downloadUrl);
  const amount = escapeHtml(
    formatCurrency(payment.transaction_amount, payment.currency_id),
  );
  const paymentMethod = escapeHtml(paymentMethodLabel(payment));
  const approvedAt = escapeHtml(
    new Intl.DateTimeFormat("es-AR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(new Date(payment.date_approved || Date.now())),
  );

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f4f4f1;font-family:Arial,Helvetica,sans-serif;color:#202020;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f1;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;">
          <tr><td style="background:#00c76f;padding:34px 30px;border-radius:18px 18px 0 0;">
            <div style="font-size:13px;font-weight:700;letter-spacing:1.8px;color:#073b26;margin-bottom:16px;">AIR FRYER 365</div>
            <div style="font-size:27px;line-height:1.25;font-weight:800;color:#ffffff;">${heading}</div>
            <div style="margin-top:10px;font-size:15px;line-height:1.5;color:#073b26;">Tu recetario digital ya está listo para descargar.</div>
          </td></tr>
          <tr><td style="background:#ffffff;padding:34px 30px;border-radius:0 0 18px 18px;">
            <p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:#4b4b4b;">Gracias por elegir recetas simples, ricas y pensadas para todos los días.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:4px 0 26px;">
              <a href="${safeDownloadUrl}" style="display:inline-block;background:#1d1d1d;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:15px 28px;border-radius:999px;">Descargar mi recetario</a>
            </td></tr></table>
            <p style="margin:0;font-size:13px;line-height:1.5;color:#777777;text-align:center;">Este enlace es personal y vence en ${expirationDays} días.</p>
          </td></tr>
          <tr><td height="18"></td></tr>
          <tr><td style="background:#ffffff;padding:30px;border-radius:18px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="font-size:19px;font-weight:800;padding-bottom:22px;">Resumen de compra</td>
                <td align="right" style="font-size:13px;font-weight:700;padding-bottom:22px;color:#666666;">Operación #${safePaymentId}</td>
              </tr>
              <tr>
                <td style="font-size:14px;padding:13px 0;border-bottom:1px solid #e8e8e8;">${safeTitle}</td>
                <td align="right" style="font-size:14px;font-weight:700;padding:13px 0;border-bottom:1px solid #e8e8e8;">${amount}</td>
              </tr>
              <tr>
                <td style="font-size:14px;font-weight:800;padding:17px 0;">Total</td>
                <td align="right" style="font-size:18px;font-weight:800;padding:17px 0;">${amount}</td>
              </tr>
            </table>
            <div style="background:#f6f6f3;border-radius:12px;padding:16px 18px;font-size:13px;line-height:1.7;color:#555555;">
              <strong>Pago:</strong> ${paymentMethod}<br>
              <strong>Fecha:</strong> ${approvedAt}<br>
              <strong>Estado:</strong> Aprobado
            </div>
          </td></tr>
          <tr><td align="center" style="padding:24px 20px 6px;font-size:12px;line-height:1.6;color:#777777;">
            Recibiste este correo porque realizaste una compra en Air Fryer 365.<br>
            Si necesitás ayuda, respondé directamente a este mensaje.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function base64UrlToBytes(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, textEncoder.encode(value)),
  );
}

function constantTimeEqual(first, second) {
  if (first.length !== second.length) return false;
  let difference = 0;
  for (let index = 0; index < first.length; index += 1) {
    difference |= first[index] ^ second[index];
  }
  return difference === 0;
}

async function createDownloadToken(env, payment, product, expirationDays) {
  if (!env.DOWNLOAD_TOKEN_SECRET) throw new Error("Falta DOWNLOAD_TOKEN_SECRET.");
  const approvedAt = Date.parse(payment.date_approved);
  const issuedAt = Number.isFinite(approvedAt) ? approvedAt : Date.now();
  const payload = bytesToBase64Url(
    textEncoder.encode(
      JSON.stringify({
        version: 1,
        paymentId: String(payment.id),
        productId: product.id,
        expiresAt: issuedAt + expirationDays * 24 * 60 * 60_000,
      }),
    ),
  );
  const signature = bytesToBase64Url(await hmac(env.DOWNLOAD_TOKEN_SECRET, payload));
  return `${payload}.${signature}`;
}

async function verifyDownloadToken(env, token, product) {
  if (!env.DOWNLOAD_TOKEN_SECRET) return { valid: false };
  try {
    const parts = String(token).split(".");
    if (parts.length !== 2) return { valid: false };
    const [payload, suppliedSignature] = parts;
    const expectedSignature = await hmac(env.DOWNLOAD_TOKEN_SECRET, payload);
    const suppliedBytes = base64UrlToBytes(suppliedSignature);
    if (!constantTimeEqual(suppliedBytes, expectedSignature)) return { valid: false };
    const data = JSON.parse(textDecoder.decode(base64UrlToBytes(payload)));
    if (
      data.version !== 1 ||
      data.productId !== product.id ||
      typeof data.paymentId !== "string" ||
      !Number.isFinite(data.expiresAt)
    ) {
      return { valid: false };
    }
    if (data.expiresAt <= Date.now()) return { valid: false, expired: true };
    return { valid: true, data };
  } catch {
    return { valid: false };
  }
}

function webhookSecretCandidates(value) {
  const trimmed = String(value || "").trim();
  const withoutAssignment = trimmed.replace(/^MP_WEBHOOK_SECRET\s*=\s*/i, "");
  const withoutQuotes = withoutAssignment.replace(/^(["'])(.*)\1$/, "$2");
  return [...new Set([trimmed, withoutAssignment, withoutQuotes].filter(Boolean))];
}

async function validateWebhookSignature(request, env, body) {
  if (!env.MP_WEBHOOK_SECRET) {
    return {
      valid: env.NODE_ENV !== "production",
      reason: "missing_server_secret",
    };
  }
  const signature = request.headers.get("x-signature") || "";
  const requestId = request.headers.get("x-request-id") || "";
  const parts = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, ...value] = part.trim().split("=");
      return [key, value.join("=")];
    }),
  );
  if (!signature) return { valid: false, reason: "missing_x_signature" };
  if (!requestId) return { valid: false, reason: "missing_x_request_id" };
  if (!parts.ts) return { valid: false, reason: "missing_signature_timestamp" };
  if (!/^[0-9a-f]{64}$/i.test(parts.v1 || "")) {
    return { valid: false, reason: "malformed_signature" };
  }

  const url = new URL(request.url);
  const signatureIds = [
    url.searchParams.get("data.id"),
    url.searchParams.get("data_id"),
    url.searchParams.get("id"),
    body?.data?.id,
    body?.id,
  ]
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);

  if (!signatureIds.length) return { valid: false, reason: "missing_signed_id" };
  const supplied = Uint8Array.from(parts.v1.match(/.{1,2}/g) || [], (byte) =>
    Number.parseInt(byte, 16),
  );
  const secrets = webhookSecretCandidates(env.MP_WEBHOOK_SECRET);
  for (const secret of secrets) {
    for (const signatureId of signatureIds) {
      const manifest = `id:${signatureId};request-id:${requestId};ts:${parts.ts};`;
      const expected = await hmac(secret, manifest);
      if (constantTimeEqual(supplied, expected)) {
        return {
          valid: true,
          reason: "valid",
          idCandidates: signatureIds.length,
          secretNormalized: secret !== String(env.MP_WEBHOOK_SECRET),
        };
      }
    }
  }
  return {
    valid: false,
    reason: "signature_mismatch",
    idCandidates: signatureIds.length,
    secretNormalized: secrets.length > 1,
  };
}

async function recordWebhookDiagnostic(env, diagnostic) {
  if (!env.DB) return;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS webhook_diagnostics (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        reason TEXT NOT NULL,
        id_candidates INTEGER NOT NULL DEFAULT 0,
        secret_normalized INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO webhook_diagnostics
        (id, reason, id_candidates, secret_normalized, created_at)
       VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         reason = excluded.reason,
         id_candidates = excluded.id_candidates,
         secret_normalized = excluded.secret_normalized,
         created_at = excluded.created_at`,
    )
      .bind(
        diagnostic.reason,
        Number(diagnostic.idCandidates || 0),
        diagnostic.secretNormalized ? 1 : 0,
        Math.floor(Date.now() / 1000),
      )
      .run();
  } catch (error) {
    console.error("No se pudo registrar el diagnÃ³stico del webhook:", error);
  }
}

async function latestWebhookDiagnostic(env) {
  if (!env.DB) return null;
  try {
    return await env.DB.prepare(
      `SELECT reason, id_candidates AS idCandidates,
              secret_normalized AS secretNormalized, created_at AS createdAt
         FROM webhook_diagnostics WHERE id = 1`,
    ).first();
  } catch {
    return null;
  }
}

async function mercadoPagoRequest(env, pathname, options = {}) {
  if (!env.MP_ACCESS_TOKEN) throw new Error("Falta MP_ACCESS_TOKEN.");
  const response = await fetch(`https://api.mercadopago.com${pathname}`, {
    ...options,
    headers: {
      authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
      "content-type": "application/json",
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Mercado Pago respondió ${response.status}: ${JSON.stringify(body).slice(0, 500)}`);
  }
  return body;
}

async function sendResendEmail(env, body, idempotencyKey) {
  if (!env.RESEND_API_KEY) throw new Error("Falta RESEND_API_KEY.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Resend respondió ${response.status}: ${JSON.stringify(result).slice(0, 500)}`);
  }
  return result;
}

async function claimPayment(env, payment, expiresAt) {
  if (!env.DB) throw new Error("Falta el binding DB de Cloudflare D1.");
  const now = Math.floor(Date.now() / 1000);
  const leaseToken = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO processed_payments
      (payment_id, status, payer_email, amount, currency, download_expires_at,
       lease_token, lease_until, created_at, updated_at)
     VALUES (?, 'processing', ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      String(payment.id),
      payment.payer?.email || null,
      Number(payment.transaction_amount),
      payment.currency_id,
      Math.floor(expiresAt / 1000),
      leaseToken,
      now + 120,
      now,
      now,
    )
    .run();

  const claim = await env.DB.prepare(
    `UPDATE processed_payments
        SET lease_token = ?, lease_until = ?, status = 'processing', updated_at = ?
      WHERE payment_id = ?
        AND status != 'completed'
        AND (lease_until < ? OR lease_token = ?)`,
  )
    .bind(leaseToken, now + 120, now, String(payment.id), now, leaseToken)
    .run();
  if (!claim.meta?.changes) return null;
  const record = await env.DB.prepare(
    `SELECT delivery_email_sent_at, seller_email_sent_at
       FROM processed_payments WHERE payment_id = ?`,
  )
    .bind(String(payment.id))
    .first();
  return { leaseToken, now, record };
}

async function markPaymentError(env, paymentId, leaseToken, error) {
  if (!env.DB || !leaseToken) return;
  await env.DB.prepare(
    `UPDATE processed_payments
        SET status = 'failed', lease_until = 0, last_error = ?, updated_at = ?
      WHERE payment_id = ? AND lease_token = ?`,
  )
    .bind(
      String(error?.message || error).slice(0, 1000),
      Math.floor(Date.now() / 1000),
      String(paymentId),
      leaseToken,
    )
    .run();
}

async function handleCheckout(request, env) {
  const product = productFromEnv(env);
  if (!Number.isFinite(product.price) || product.price <= 0) {
    return json({ error: "El precio del producto no es válido." }, 500);
  }
  const checkoutReference = crypto.randomUUID();
  const body = {
    items: [
      {
        id: product.id,
        title: product.title,
        description: product.description,
        quantity: 1,
        currency_id: product.currency,
        unit_price: product.price,
      },
    ],
    external_reference: checkoutReference,
    binary_mode: false,
    statement_descriptor: env.MP_STATEMENT_DESCRIPTOR || undefined,
    back_urls: {
      success: publicUrl(request, env, "gracias.html"),
      failure: publicUrl(request, env, "?checkout=error"),
      pending: publicUrl(request, env, "?checkout=pending"),
    },
    auto_return: "approved",
    notification_url: publicUrl(request, env, "api/webhooks/mercadopago"),
  };
  const preference = await mercadoPagoRequest(env, "/checkout/preferences", {
    method: "POST",
    headers: { "x-idempotency-key": checkoutReference },
    body: JSON.stringify(body),
  });
  // Mercado Pago ejecuta las pruebas con usuarios y credenciales de prueba,
  // pero el Checkout Pro actual se inicia siempre desde init_point.
  const checkoutUrl = preference.init_point;
  if (!checkoutUrl) throw new Error("Mercado Pago no devolvió una URL de pago.");
  return json({ checkoutUrl }, 201);
}

async function handleWebhook(request, env) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const paymentId = String(
    url.searchParams.get("data.id") ||
      url.searchParams.get("data_id") ||
      body?.data?.id ||
      "",
  ).trim();
  const eventType = String(body?.type || url.searchParams.get("type") || "");
  if (!paymentId || (eventType && eventType !== "payment")) {
    return new Response(null, { status: 200 });
  }
  const signatureValidation = await validateWebhookSignature(request, env, body);
  await recordWebhookDiagnostic(env, signatureValidation);
  if (!signatureValidation.valid) {
    return new Response(null, { status: 401 });
  }

  let leaseToken = null;
  try {
    const product = productFromEnv(env);
    const payment = await mercadoPagoRequest(env, `/v1/payments/${encodeURIComponent(paymentId)}`);
    if (payment.status !== "approved") return new Response(null, { status: 200 });

    const validProduct = payment.additional_info?.items?.some(
      (item) => item.id === product.id,
    );
    const validAmount =
      Number(payment.transaction_amount) === product.price &&
      payment.currency_id === product.currency;
    if (!validAmount || (payment.additional_info?.items && !validProduct)) {
      throw new Error(`El pago ${paymentId} no coincide con el producto esperado.`);
    }

    const expirationDays = Number(env.LINK_EXPIRATION_DAYS || 30);
    const approvedAt = Date.parse(payment.date_approved);
    const expiresAt =
      (Number.isFinite(approvedAt) ? approvedAt : Date.now()) +
      expirationDays * 24 * 60 * 60_000;
    const claim = await claimPayment(env, payment, expiresAt);
    if (!claim) return new Response(null, { status: 200 });
    leaseToken = claim.leaseToken;

    const token = await createDownloadToken(env, payment, product, expirationDays);
    const downloadUrl = publicUrl(
      request,
      env,
      `api/downloads/${encodeURIComponent(token)}`,
    );
    const payerEmail = payment.payer?.email;
    const sandboxRecipient =
      env.MP_ENVIRONMENT !== "production" ? env.SELLER_EMAIL : null;
    const deliveryEmail = sandboxRecipient || payerEmail;
    if (!deliveryEmail) throw new Error("El pago no tiene un correo de entrega.");

    const payerName = [payment.payer?.first_name, payment.payer?.last_name]
      .filter(Boolean)
      .join(" ");
    const greeting = payerName ? `, ${payerName}` : "";
    const now = Math.floor(Date.now() / 1000);
    if (!claim.record?.delivery_email_sent_at) {
      await sendResendEmail(
        env,
        {
          from: env.EMAIL_FROM,
          to: [deliveryEmail],
          reply_to: env.SUPPORT_EMAIL || env.SELLER_EMAIL || undefined,
          subject: `Tu compra fue aprobada — ${product.title}`,
          text: `¡Gracias por tu compra${greeting}!\n\nDescargá tu recetario: ${downloadUrl}\n\nEl enlace vence en ${expirationDays} días.`,
          html: purchaseEmailHtml(
            payment,
            downloadUrl,
            payerName,
            product,
            expirationDays,
          ),
        },
        `purchase-delivery/${payment.id}`,
      );
      await env.DB.prepare(
        `UPDATE processed_payments
            SET delivery_email_sent_at = ?, updated_at = ?
          WHERE payment_id = ? AND lease_token = ?`,
      )
        .bind(now, now, String(payment.id), leaseToken)
        .run();
    }

    if (env.SELLER_EMAIL && !claim.record?.seller_email_sent_at) {
      await sendResendEmail(
        env,
        {
          from: env.EMAIL_FROM,
          to: [env.SELLER_EMAIL],
          reply_to: env.SUPPORT_EMAIL || env.SELLER_EMAIL,
          subject: `Venta confirmada — ${payment.id}`,
          text: `Pago ${payment.id} aprobado por ${payment.transaction_amount} ${payment.currency_id}. Comprador: ${payerEmail || "sin correo"}.`,
        },
        `seller-notification/${payment.id}`,
      );
    }

    await env.DB.prepare(
      `UPDATE processed_payments
          SET status = 'completed', seller_email_sent_at = ?, lease_until = 0,
              last_error = NULL, updated_at = ?
        WHERE payment_id = ? AND lease_token = ?`,
    )
      .bind(now, now, String(payment.id), leaseToken)
      .run();
    return new Response(null, { status: 200 });
  } catch (error) {
    await markPaymentError(env, paymentId, leaseToken, error);
    console.error("Error procesando el webhook:", error);
    return new Response(null, { status: 500 });
  }
}

async function handleDownload(request, env, token) {
  const product = productFromEnv(env);
  const verification = await verifyDownloadToken(env, token, product);
  if (verification.expired) return new Response("El enlace venció.", { status: 410 });
  if (!verification.valid) return new Response("Enlace inválido.", { status: 404 });
  if (!env.RECETARIO_BUCKET) {
    return new Response("El almacenamiento no está configurado.", { status: 503 });
  }
  const object = await env.RECETARIO_BUCKET.get(env.PDF_OBJECT_KEY || "recetario.pdf");
  if (!object) return new Response("No se encontró el recetario.", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", "application/pdf");
  headers.set(
    "content-disposition",
    'attachment; filename="Air_Fryer_365_Recetas_Saludables.pdf"',
  );
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
}

function previewEmail(env) {
  if (env.NODE_ENV === "production") return new Response(null, { status: 404 });
  const product = productFromEnv(env);
  const samplePayment = {
    id: "179681082873",
    transaction_amount: product.price,
    currency_id: product.currency,
    payment_type_id: "credit_card",
    payment_method_id: "visa",
    date_approved: new Date().toISOString(),
  };
  return new Response(
    purchaseEmailHtml(
      samplePayment,
      "#descarga-de-ejemplo",
      "Pilar",
      product,
      Number(env.LINK_EXPIRATION_DAYS || 30),
    ),
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.hostname === "www.buenasrecetas.com.ar") {
        url.hostname = "buenasrecetas.com.ar";
        return Response.redirect(url.toString(), 301);
      }
      if (request.method === "GET" && url.pathname === "/api/checkout/config") {
        const product = productFromEnv(env);
        return json({
          title: product.title,
          price: product.price,
          currency: product.currency,
        });
      }
      if (request.method === "GET" && url.pathname === "/api/health") {
        return json({
          ok: true,
          revision: "verified-email-domain-v1",
          webhook: await latestWebhookDiagnostic(env),
        });
      }
      if (request.method === "POST" && url.pathname === "/api/checkout") {
        return await handleCheckout(request, env);
      }
      if (
        request.method === "POST" &&
        url.pathname === "/api/webhooks/mercadopago"
      ) {
        return await handleWebhook(request, env);
      }
      if (request.method === "GET" && url.pathname.startsWith("/api/downloads/")) {
        const token = decodeURIComponent(url.pathname.slice("/api/downloads/".length));
        return await handleDownload(request, env, token);
      }
      if (request.method === "GET" && url.pathname === "/preview-email") {
        return previewEmail(env);
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("Error no controlado:", error);
      return json({ error: "No se pudo completar la solicitud." }, 500);
    }
  },
};
