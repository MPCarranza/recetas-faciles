require("dotenv").config();
const express = require("express");
const mercadopago = require("mercadopago");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Configure Mercado Pago SDK
if (process.env.MP_ACCESS_TOKEN) {
  try {
    if (
      mercadopago.configurations &&
      mercadopago.configurations.setAccessToken
    ) {
      mercadopago.configurations.setAccessToken(process.env.MP_ACCESS_TOKEN);
    } else if (typeof mercadopago.configure === "function") {
      mercadopago.configure({ access_token: process.env.MP_ACCESS_TOKEN });
    }
  } catch (err) {
    console.warn(
      "No se pudo configurar el SDK de Mercado Pago automáticamente:",
      err.message || err,
    );
  }
} else {
  console.warn(
    "Atención: no se encontró la variable de entorno MP_ACCESS_TOKEN. Coloca tus credenciales en .env o en el entorno.",
  );
}

// Configure email transporter (nodemailer)
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure:
      process.env.SMTP_SECURE === "true" || process.env.SMTP_SECURE === "1",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
} else {
  console.warn(
    "SMTP no configurado. No se podrán enviar correos. Configurá SMTP_HOST, SMTP_USER y SMTP_PASS en .env",
  );
}

// Keep track of processed payments to avoid duplicate emails (in-memory, replace with DB in prod)
const processedPayments = new Set();
// In-memory store for download tokens: token -> { paymentId, expiresAt, file }
const downloadTokens = new Map();

const LINK_EXPIRATION_MINUTES = parseInt(
  process.env.LINK_EXPIRATION_MINUTES || "1440",
  10,
);

// Periodic cleanup of expired tokens
setInterval(
  () => {
    const now = Date.now();
    for (const [token, meta] of downloadTokens.entries()) {
      if (meta.expiresAt <= now) downloadTokens.delete(token);
    }
  },
  1000 * 60 * 10,
);

// Endpoint to create a Mercado Pago preference
app.post("/create_preference", async (req, res) => {
  try {
    const body = req.body || {};
    const items = body.items || [];

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items are required" });
    }

    const preference = {
      items,
      back_urls: {
        success: process.env.BACK_URL_SUCCESS || "/gracias.html",
        failure: process.env.BACK_URL_FAILURE || "/",
        pending: process.env.BACK_URL_PENDING || "/",
      },
      auto_return: "approved",
      binary_mode: false,
    };

    // You can optionally set notification_url here, but it's recommended to register webhooks in Mercado Pago dashboard
    if (process.env.MP_NOTIFICATION_URL)
      preference.notification_url = process.env.MP_NOTIFICATION_URL;

    const response = await mercadopago.preferences.create(preference);
    return res.json({
      init_point: response.body.init_point,
      sandbox_init_point: response.body.sandbox_init_point,
    });
  } catch (err) {
    console.error("Error creating preference:", err);
    return res.status(500).json({ error: "error creating preference" });
  }
});

// Helper: send buyer email with attachment
async function sendBuyerEmail(toEmail, buyerName, attachmentPath) {
  if (!transporter) throw new Error("No SMTP transporter configured");
  const fileName = path.basename(attachmentPath);
  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: "Gracias por tu compra — Air Fryer 365 Recetas",
    text: `¡Gracias por tu compra, ${buyerName || ""}!\n\nAdjunto encontrarás el recetario en PDF. Si no lo ves en tu bandeja de entrada, revisá la carpeta de spam o promociones.\n\nDisfrutalo!`,
    html: `<p>¡Gracias por tu compra${buyerName ? `, <strong>${buyerName}</strong>` : ""}!</p><p>Adjunto encontrarás el recetario en PDF. Si no lo ves en tu bandeja de entrada, revisá la carpeta de <em>spam</em> o <em>promociones</em>.</p><p>Disfrutalo!</p>`,
    attachments: [{ filename: fileName, path: attachmentPath }],
  };

  return transporter.sendMail(mailOptions);
}

// Helper: send notification to seller
async function sendSellerNotification(sellerEmail, paymentInfo) {
  if (!transporter) throw new Error("No SMTP transporter configured");
  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: sellerEmail,
    subject: `Venta confirmada — ${paymentInfo.orderId || paymentInfo.paymentId || ""}`,
    text: `Se realizó una venta.\n\nDetalle:\nID pago: ${paymentInfo.paymentId}\nEstado: ${paymentInfo.status}\nMonto: ${paymentInfo.amount}\nEmail comprador: ${paymentInfo.payerEmail || "N/A"}`,
    html: `<p>Se realizó una venta.</p><ul><li>ID pago: ${paymentInfo.paymentId}</li><li>Estado: ${paymentInfo.status}</li><li>Monto: ${paymentInfo.amount}</li><li>Email comprador: ${paymentInfo.payerEmail || "N/A"}</li></ul>`,
  };

  return transporter.sendMail(mailOptions);
}

// Send buyer an email containing a secure expirable download link
async function sendBuyerEmailWithLink(toEmail, buyerName, downloadUrl) {
  if (!transporter) throw new Error("No SMTP transporter configured");
  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: "Tu recetario — Air Fryer 365 Recetas",
    text: `¡Gracias por tu compra${buyerName ? `, ${buyerName}` : ""}!\n\nDescargá tu recetario aquí: ${downloadUrl}\n\nSi no encontrás el correo, revisá la carpeta de spam o promociones.`,
    html: `<p>¡Gracias por tu compra${buyerName ? `, <strong>${buyerName}</strong>` : ""}!</p><p>Descargá tu recetario haciendo <a href="${downloadUrl}">clic aquí</a>.</p><p>Si no encontrás el correo, revisá la carpeta de <em>spam</em> o <em>promociones</em>.</p>`,
  };

  return transporter.sendMail(mailOptions);
}

// Webhook endpoint to receive notifications from Mercado Pago
// Use `express.raw` to obtain the raw body for HMAC verification when needed
app.post("/webhook", express.raw({ type: "*/*" }), async (req, res) => {
  try {
    const rawBody = req.body; // Buffer when using express.raw

    // Optional HMAC verification if MP_WEBHOOK_KEY is configured and a signature header is present
    const webhookKey = process.env.MP_WEBHOOK_KEY;
    const signatureHeader =
      req.headers["x-hub-signature-256"] ||
      req.headers["x-hub-signature"] ||
      req.headers["x-meli-signature"] ||
      req.headers["x-mercadopago-signature"];

    if (webhookKey && signatureHeader) {
      try {
        const hmac = crypto.createHmac("sha256", webhookKey);
        hmac.update(rawBody);
        const digestHex = hmac.digest("hex");
        const expected1 = `sha256=${digestHex}`;
        const expected2 = digestHex;

        // Compare using timingSafeEqual when possible
        const provided = String(signatureHeader).trim();
        const ok = provided === expected1 || provided === expected2;

        if (!ok) {
          console.warn("Firma HMAC inválida en webhook");
          return res.status(401).send("invalid signature");
        }
      } catch (err) {
        console.error("Error verificando firma HMAC:", err);
        return res.status(500).send("signature verification error");
      }
    } else if (webhookKey && !signatureHeader) {
      console.warn(
        "MP_WEBHOOK_KEY configurado pero no se recibió header de firma; rechazando por seguridad",
      );
      return res.status(400).send("missing signature header");
    }

    // Parse JSON body (some providers send notifications as JSON)
    let parsed = {};
    try {
      parsed =
        rawBody && rawBody.length ? JSON.parse(rawBody.toString("utf8")) : {};
    } catch (e) {
      parsed = {};
    }

    // Mercado Pago may send data.id in different places or as query params
    let dataId =
      (parsed.data && parsed.data.id) ||
      parsed.id ||
      (parsed.resource && parsed.resource.id) ||
      req.query["data.id"] ||
      req.query.id ||
      req.query["id"];

    if (!dataId) {
      console.warn("Webhook recibido sin data.id");
      return res.status(400).send("no data id");
    }

    const paymentId = dataId;
    console.log("Webhook payment id:", paymentId);

    // Avoid re-processing same payment
    if (processedPayments.has(paymentId)) {
      return res.status(200).send("ok");
    }

    // Retrieve payment info from Mercado Pago to validate status
    const payment = await mercadopago.payment.findById(paymentId);
    const p = payment && payment.body ? payment.body : payment ? payment : null;

    if (!p) {
      console.warn("No se encontró información del pago", paymentId);
      return res.status(404).send("payment not found");
    }

    const status = p.status;
    const amount =
      p.transaction_amount || p.transaction_amounts || p.total_paid_amount || 0;
    const payerEmail =
      (p.payer && (p.payer.email || p.payer.email_address)) ||
      (p.additional_info &&
        p.additional_info.payer &&
        p.additional_info.payer.first_name) ||
      null;
    const payerName =
      (p.payer &&
        `${p.payer.first_name || ""} ${p.payer.last_name || ""}`.trim()) ||
      "";

    if (status === "approved") {
      // mark processed
      processedPayments.add(paymentId);

      // Create expirable download token and send email containing the secure link
      const pdfPath = process.env.PDF_PATH || "./digital/recetario.pdf";
      const absolutePdf = path.isAbsolute(pdfPath)
        ? pdfPath
        : path.join(__dirname, pdfPath);

      if (fs.existsSync(absolutePdf) && transporter) {
        try {
          // create token
          const token = crypto.randomBytes(24).toString("hex");
          const expiresAt = Date.now() + LINK_EXPIRATION_MINUTES * 60 * 1000;
          downloadTokens.set(token, {
            paymentId,
            expiresAt,
            file: absolutePdf,
          });

          const baseUrl =
            process.env.APP_BASE_URL || `http://${req.headers.host}`;
          const downloadUrl = `${baseUrl.replace(/\/$/, "")}/download/${token}`;

          await sendBuyerEmailWithLink(
            payerEmail || "",
            payerName,
            downloadUrl,
          );
          console.log("Email con enlace enviado al comprador:", payerEmail);
        } catch (err) {
          console.error("Error enviando email con enlace al comprador:", err);
        }
      } else {
        console.warn(
          "Archivo PDF no encontrado o SMTP no configurado:",
          absolutePdf,
        );
      }

      // Notify seller
      const sellerEmail = process.env.SELLER_EMAIL;
      if (sellerEmail && transporter) {
        try {
          await sendSellerNotification(sellerEmail, {
            paymentId,
            status,
            amount,
            payerEmail,
          });
          console.log("Notificación enviada al vendedor:", sellerEmail);
        } catch (err) {
          console.error("Error enviando notificación al vendedor:", err);
        }
      }
    }

    return res.status(200).send("received");
  } catch (err) {
    console.error("Error en webhook:", err);
    return res.status(500).send("error");
  }
});

// Endpoint to download a PDF via a secure token
app.get("/download/:token", async (req, res) => {
  try {
    const token = req.params.token;
    const meta = downloadTokens.get(token);
    if (!meta) return res.status(404).send("Enlace inválido o expirado");

    if (meta.expiresAt <= Date.now()) {
      downloadTokens.delete(token);
      return res.status(410).send("Enlace expirado");
    }

    const filePath = meta.file;
    if (!fs.existsSync(filePath))
      return res.status(404).send("Archivo no encontrado");

    // Optionally, delete token after first download to make link single-use
    // downloadTokens.delete(token);

    return res.download(filePath, path.basename(filePath));
  } catch (err) {
    console.error("Error en /download:", err);
    return res.status(500).send("error");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
