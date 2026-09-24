# Integración de Mercado Pago — Recetario Air Fryer 365 Recetas

Resumen corto:

- Recomendación: usar **Checkout Pro de Mercado Pago** (preferible para ventas digitales rápidas). Es simple, seguro y evita manejar tarjetas en tu servidor.

Qué agregué al proyecto:

- Un servidor Node.js mínimo que expone `POST /create_preference` para crear una preference en Mercado Pago.
- Frontend actualizado para iniciar el checkout llamando al endpoint y redirigir al `init_point` (o `sandbox_init_point` en modo pruebas).

Instalación y prueba local:

1. Copia las credenciales:

```bash
cp .env.example .env
# Edita .env y pega tu MP_ACCESS_TOKEN (modo sandbox recomendado para pruebas)
```

2. Instala dependencias e inicia la app:

```bash
npm install
npm start
```

3. Abre `http://localhost:3000` y pulsa "QUIERO MI RECETARIO" para probar el flujo.

Notas sobre Mercado Pago y pruebas:

- Usa tu Access Token de pruebas (sandbox) desde tu cuenta de Mercado Pago.
- Mercado Pago proporciona `sandbox_init_point` en la respuesta; el frontend redirige a ese URL si está disponible.
- Para pruebas con tarjeta usa los números de tarjeta de prueba que Mercado Pago documenta en su panel de desarrollador.

Webhooks y entrega automática del PDF

- El proyecto ahora incluye un endpoint `/webhook` que procesa notificaciones de Mercado Pago.
- Al confirmarse un pago (`status === 'approved'`) el servidor intentará enviar por email el PDF configurado en `PDF_PATH` al comprador y notificará por email al vendedor (`SELLER_EMAIL`).

Configuración adicional necesaria:

1. Configurar SMTP en tu `.env` (ejemplo en `.env.example`). Puedes usar SendGrid SMTP o cualquier proveedor SMTP.
2. En Mercado Pago (tu cuenta de desarrollador) registrá la URL de webhook apuntando a `https://TU_DOMINIO/webhook`. Para pruebas locales usá `ngrok` y poné la URL pública en el panel de Mercado Pago.

Prueba rápida con ngrok (local):

```bash
# instala ngrok y exponé tu servidor
ngrok http 3000
# copia la URL https que te devuelva ngrok, por ejemplo https://abc123.ngrok.io
# en Mercado Pago -> Webhooks o Notificaciones -> agrega: https://abc123.ngrok.io/webhook
```

Notas de seguridad y producción

- En producción, guardá las ventas procesadas en una base de datos para evitar duplicados y auditar entregas.
- No uses credenciales de producción en tu entorno de pruebas.
- Recomendado: proteger el endpoint `/webhook` verificando firmas o restringiendo por IP si Mercado Pago provee esa info.

Entrega segura del PDF (enlaces expirable localmente)

- En lugar de adjuntar el PDF, el servidor genera un enlace expirable (por defecto 24 horas) que permite descargar el archivo de forma segura. Esto evita adjuntos pesados y mejora control sobre expiración.
- Parámetros útiles en `.env`:
  - `APP_BASE_URL`: URL pública base para construir enlaces (ej. https://mi-dominio.com). Si no está definida se intenta derivar del header `Host`.
  - `LINK_EXPIRATION_MINUTES`: duración en minutos del enlace.

Flujo de entrega con enlace expirable:

1. Pago aprobado → webhook recibe notificación.
2. Servidor crea un token expirable y lo asocia al archivo PDF.
3. Servidor envía al comprador un correo con el enlace `https://.../download/<token>` y notifica al vendedor.
4. El enlace expira tras `LINK_EXPIRATION_MINUTES` y puede ser invalidado tras su uso (opcional).

Pruebas locales con PDF

- Crea la carpeta `digital` en el proyecto y coloca tu PDF con el nombre `recetario.pdf` o ajustá `PDF_PATH` en `.env`.
- Ejemplo:

```bash
mkdir digital
# copia tu archivo recetario.pdf dentro de digital/
```

Recomendaciones de solución de pagos (breve):

- Checkout Pro (hosted): ideal si querés la integración más simple y cumplir con PCI sin manejar datos de tarjetas.
- Checkout API + SDK (custom): si necesitás experiencia de compra totalmente integrada en tu sitio, pero requiere más trabajo y seguridad.
- Suscripciones: si en el futuro ofrece suscripciones o acceso recurrente, mirar Mercado Pago Subscriptions.

Si querés, puedo:

- Configurar webhooks para confirmar pagos automáticamente y enviar el PDF por correo.
- Integrar un envío automático del PDF (por ejemplo, usando SendGrid o similar) cuando el pago esté aprobado.

# recetas-faciles
