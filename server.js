require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const nodemailer = require("nodemailer");
const { MercadoPagoConfig, Payment, Preference } = require("mercadopago");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.use(
  "/assets",
  express.static(path.join(__dirname, "assets"), { index: false }),
);
app.get(["/", "/index.html"], (_req, res) =>
  res.sendFile(path.join(__dirname, "index.html")),
);
app.get("/gracias.html", (_req, res) =>
  res.sendFile(path.join(__dirname, "gracias.html")),
);
app.get(["/styles.css", "/script.js"], (req, res) =>
  res.sendFile(path.join(__dirname, path.basename(req.path))),
);

const accessToken = process.env.MP_ACCESS_TOKEN;
const mpClient = accessToken
  ? new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } })
  : null;
const preferenceClient = mpClient ? new Preference(mpClient) : null;
const paymentClient = mpClient ? new Payment(mpClient) : null;

const product = Object.freeze({
  id: process.env.PRODUCT_ID || "air-fryer-365",
  title: process.env.PRODUCT_TITLE || "Air Fryer 365 Recetas",
  description:
    process.env.PRODUCT_DESCRIPTION || "Recetario digital en formato PDF",
  price: Number(process.env.PRODUCT_PRICE || 17999),
  currency: process.env.PRODUCT_CURRENCY || "ARS",
});

if (!accessToken) {
  console.warn("Falta MP_ACCESS_TOKEN: el checkout no podrá crear preferencias.");
}
if (!Number.isFinite(product.price) || product.price <= 0) {
  throw new Error("PRODUCT_PRICE debe ser un número mayor que cero.");
}

let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
} else {
  console.warn("SMTP no configurado: no se enviarán enlaces de descarga.");
}

// Evita procesar dos veces el mismo webhook mientras esta instancia está activa.
const processedPayments = new Map();
const linkExpirationDays = Number(process.env.LINK_EXPIRATION_DAYS || 30);
if (!Number.isFinite(linkExpirationDays) || linkExpirationDays <= 0) {
  throw new Error("LINK_EXPIRATION_DAYS debe ser un número mayor que cero.");
}
const downloadTokenSecret = process.env.DOWNLOAD_TOKEN_SECRET || accessToken;
if (process.env.NODE_ENV === "production" && !process.env.DOWNLOAD_TOKEN_SECRET) {
  throw new Error("Falta DOWNLOAD_TOKEN_SECRET en producción.");
}

function publicUrl(relativePath) {
  const baseUrl = process.env.APP_BASE_URL;
  if (!baseUrl) return null;
  return new URL(relativePath, `${baseUrl.replace(/\/$/, "")}/`).toString();
}

function paymentIdFrom(req) {
  return String(
    req.query["data.id"] || req.query.data_id || req.body?.data?.id || "",
  ).trim();
}

function productPdfPath() {
  const relativePdfPath = process.env.PDF_PATH || "digital/recetario.pdf";
  const pdfPath = path.resolve(__dirname, relativePdfPath);
  const allowedRoot = path.resolve(__dirname, "digital") + path.sep;
  if (!pdfPath.startsWith(allowedRoot) || !fs.existsSync(pdfPath)) {
    throw new Error("PDF_PATH debe apuntar a un archivo dentro de digital/.");
  }
  return pdfPath;
}

function createDownloadToken(payment) {
  if (!downloadTokenSecret) {
    throw new Error("Falta DOWNLOAD_TOKEN_SECRET o MP_ACCESS_TOKEN.");
  }

  const approvedAt = Date.parse(payment.date_approved);
  const issuedAt = Number.isFinite(approvedAt) ? approvedAt : Date.now();
  const payload = Buffer.from(
    JSON.stringify({
      version: 1,
      paymentId: String(payment.id),
      productId: product.id,
      expiresAt: issuedAt + linkExpirationDays * 24 * 60 * 60_000,
    }),
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", downloadTokenSecret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function verifyDownloadToken(token) {
  if (!downloadTokenSecret) return { valid: false };

  try {
    const parts = String(token).split(".");
    if (parts.length !== 2) return { valid: false };
    const [payload, suppliedSignature] = parts;
    const expectedSignature = crypto
      .createHmac("sha256", downloadTokenSecret)
      .update(payload)
      .digest();
    const suppliedBuffer = Buffer.from(suppliedSignature, "base64url");
    if (
      suppliedBuffer.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(suppliedBuffer, expectedSignature)
    ) {
      return { valid: false };
    }

    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
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

function isValidWebhookSignature(req) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";

  const signature = String(req.get("x-signature") || "");
  const requestId = String(req.get("x-request-id") || "");
  const parts = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, ...value] = part.trim().split("=");
      return [key, value.join("=")];
    }),
  );
  if (
    !parts.ts ||
    !requestId ||
    !/^[0-9a-f]{64}$/i.test(parts.v1 || "")
  ) {
    return false;
  }

  const signatureIds = [
    req.query["data.id"],
    req.query.data_id,
    req.query.id,
    req.body?.data?.id,
    req.body?.id,
  ]
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);

  if (!signatureIds.length) return false;
  const suppliedBuffer = Buffer.from(parts.v1, "utf8");
  return signatureIds.some((signatureId) => {
    const manifest = `id:${signatureId};request-id:${requestId};ts:${parts.ts};`;
    const expected = crypto
      .createHmac("sha256", secret.trim())
      .update(manifest)
      .digest("hex");
    const expectedBuffer = Buffer.from(expected, "utf8");
    return (
      suppliedBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)
    );
  });
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

function purchaseEmailHtml(payment, downloadUrl, payerName) {
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
            <p style="margin:0;font-size:13px;line-height:1.5;color:#777777;text-align:center;">Este enlace es personal y vence en ${linkExpirationDays} días.</p>
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
            Recibiste este correo porque realizaste una compra en Buenas recetas.<br>
            Si necesitás ayuda, respondé directamente a este mensaje.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

async function sendPurchaseEmails(payment, downloadUrl) {
  const payerEmail = payment.payer?.email;
  const sandboxRecipient =
    process.env.MP_ENVIRONMENT !== "production"
      ? process.env.SELLER_EMAIL
      : null;
  const deliveryEmail = sandboxRecipient || payerEmail;
  if (!transporter || !deliveryEmail) return;

  const payerName = [payment.payer?.first_name, payment.payer?.last_name]
    .filter(Boolean)
    .join(" ");
  const greeting = payerName ? `, ${payerName}` : "";

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    replyTo: process.env.SUPPORT_EMAIL || process.env.SELLER_EMAIL || undefined,
    to: deliveryEmail,
    subject: `Tu compra fue aprobada — ${product.title}`,
    text: `¡Gracias por tu compra${greeting}!\n\nDescargá tu recetario: ${downloadUrl}\n\nEl enlace vence en ${linkExpirationDays} días.`,
    html: purchaseEmailHtml(payment, downloadUrl, payerName),
  });

  if (process.env.SELLER_EMAIL) {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.SELLER_EMAIL,
      subject: `Venta confirmada — ${payment.id}`,
      text: `Pago ${payment.id} aprobado por ${payment.transaction_amount} ${payment.currency_id}. Comprador: ${payerEmail}.`,
    });
  }
}

app.get("/preview-email", (_req, res) => {
  if (process.env.MP_ENVIRONMENT === "production") return res.sendStatus(404);

  const samplePayment = {
    id: "179681082873",
    transaction_amount: product.price,
    currency_id: product.currency,
    payment_type_id: "credit_card",
    payment_method_id: "visa",
    date_approved: new Date().toISOString(),
  };
  const sampleDownloadUrl = publicUrl("#descarga-de-ejemplo") || "#";

  res.type("html").send(
    purchaseEmailHtml(samplePayment, sampleDownloadUrl, "Pilar"),
  );
});

app.get("/api/checkout/config", (_req, res) => {
  res.json({ title: product.title, price: product.price, currency: product.currency });
});

app.post("/api/checkout", async (_req, res) => {
  if (!preferenceClient) {
    return res.status(503).json({ error: "Mercado Pago no está configurado." });
  }

  try {
    const checkoutReference = crypto.randomUUID();
    const successUrl = publicUrl("gracias.html");
    const failureUrl = publicUrl("?checkout=error");
    const pendingUrl = publicUrl("?checkout=pending");
    const notificationUrl = publicUrl("api/webhooks/mercadopago");

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
      statement_descriptor: process.env.MP_STATEMENT_DESCRIPTOR || undefined,
      ...(successUrl
        ? {
            back_urls: {
              success: successUrl,
              failure: failureUrl,
              pending: pendingUrl,
            },
            auto_return: "approved",
          }
        : {}),
      ...(notificationUrl ? { notification_url: notificationUrl } : {}),
    };

    const preference = await preferenceClient.create({
      body,
      requestOptions: { idempotencyKey: checkoutReference },
    });
    // Las pruebas usan usuarios y credenciales de prueba, pero Checkout Pro
    // debe iniciarse desde el init_point normal de Mercado Pago.
    const checkoutUrl = preference.init_point;

    if (!checkoutUrl) throw new Error("Mercado Pago no devolvió una URL de pago.");
    return res.status(201).json({ checkoutUrl });
  } catch (error) {
    console.error("No se pudo crear el checkout:", error);
    return res.status(502).json({ error: "No se pudo iniciar el pago." });
  }
});

app.post("/api/purchases/access", async (req, res) => {
  const paymentId = String(req.body?.paymentId || "").trim();
  const externalReference = String(req.body?.externalReference || "").trim();
  if (!/^\d+$/.test(paymentId) || !/^[0-9a-f-]{36}$/i.test(externalReference)) {
    return res.status(400).json({ error: "Los datos de la compra no son válidos." });
  }
  if (!paymentClient) {
    return res.status(503).json({ error: "Mercado Pago no estÃ¡ configurado." });
  }

  try {
    const payment = await paymentClient.get({ id: paymentId });
    if (
      payment.status !== "approved" ||
      String(payment.external_reference || "") !== externalReference
    ) {
      return res.status(403).json({ error: "No se pudo validar la compra." });
    }

    const validProduct = payment.additional_info?.items?.some(
      (item) => item.id === product.id,
    );
    const validAmount =
      Number(payment.transaction_amount) === product.price &&
      payment.currency_id === product.currency;
    if (!validAmount || (payment.additional_info?.items && !validProduct)) {
      return res.status(403).json({ error: "La compra no corresponde a este producto." });
    }

    productPdfPath();
    const token = createDownloadToken(payment);
    const downloadUrl = publicUrl(`api/downloads/${token}`);
    if (!downloadUrl) throw new Error("Falta APP_BASE_URL.");
    return res.json({ downloadUrl });
  } catch (error) {
    console.error("No se pudo preparar la descarga:", error);
    return res.status(502).json({ error: "No se pudo preparar la descarga." });
  }
});

app.post("/api/webhooks/mercadopago", async (req, res) => {
  const paymentId = paymentIdFrom(req);
  const eventType = String(req.body?.type || req.query.type || "");
  if (!paymentId || (eventType && eventType !== "payment")) {
    return res.sendStatus(200);
  }
  if (!isValidWebhookSignature(req)) return res.sendStatus(401);

  if (!paymentClient) return res.sendStatus(503);
  if (processedPayments.has(paymentId)) return res.sendStatus(200);
  processedPayments.set(paymentId, "processing");

  try {
    const payment = await paymentClient.get({ id: paymentId });
    if (payment.status !== "approved") {
      processedPayments.delete(paymentId);
      return res.sendStatus(200);
    }

    const validProduct = payment.additional_info?.items?.some(
      (item) => item.id === product.id,
    );
    const validAmount =
      Number(payment.transaction_amount) === product.price &&
      payment.currency_id === product.currency;
    if (!validAmount || (payment.additional_info?.items && !validProduct)) {
      throw new Error(`El pago ${paymentId} no coincide con el producto esperado.`);
    }

    productPdfPath();
    const token = createDownloadToken(payment);
    const downloadUrl = publicUrl(`api/downloads/${token}`);
    if (!downloadUrl) throw new Error("Falta APP_BASE_URL.");
    await sendPurchaseEmails(payment, downloadUrl);
    processedPayments.set(paymentId, "completed");
    return res.sendStatus(200);
  } catch (error) {
    processedPayments.delete(paymentId);
    console.error("Error procesando el pago notificado:", error);
    return res.sendStatus(500);
  }
});

app.get("/api/downloads/:token", (req, res) => {
  const verification = verifyDownloadToken(req.params.token);
  if (verification.expired) return res.status(410).send("El enlace venció.");
  if (!verification.valid) return res.status(404).send("Enlace inválido.");

  try {
    const pdfPath = productPdfPath();
    return res.download(pdfPath, path.basename(pdfPath));
  } catch (error) {
    console.error("No se pudo entregar el PDF:", error);
    return res.status(500).send("No se pudo entregar el archivo.");
  }
});

app.listen(PORT, () => {
  console.log(`Servidor disponible en http://localhost:${PORT}`);
});
