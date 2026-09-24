require("dotenv").config();

const nodemailer = require("nodemailer");

const requiredVariables = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "SELLER_EMAIL",
];

const missingVariables = requiredVariables.filter(
  (variable) => !process.env[variable]?.trim(),
);

if (missingVariables.length) {
  console.error(`Faltan variables: ${missingVariables.join(", ")}`);
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function main() {
  await transporter.verify();
  const result = await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: process.env.SELLER_EMAIL,
    subject: "Prueba de entrega - Air Fryer 365",
    text: "La configuración de correo funciona correctamente. El próximo paso es probar la entrega automática después de un pago.",
    html: "<p>La configuración de correo funciona correctamente.</p><p>El próximo paso es probar la entrega automática después de un pago.</p>",
  });

  console.log(`Correo de prueba enviado (${result.messageId}).`);
}

main().catch((error) => {
  console.error(`No se pudo enviar el correo: ${error.message}`);
  process.exit(1);
});
