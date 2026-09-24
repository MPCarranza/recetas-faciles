# Recetas fáciles + Mercado Pago

La integración usa **Checkout Pro**: el comprador sale al entorno seguro de
Mercado Pago, completa el pago y vuelve al sitio. Para un único producto digital
es la opción con mejor equilibrio entre conversión, seguridad y mantenimiento.

## 1. Crear la aplicación en Mercado Pago

La creación requiere iniciar sesión y confirmar la identidad del titular:

1. Entrá a [Tus integraciones](https://www.mercadopago.com.ar/developers/panel/app).
2. Elegí **Crear aplicación**.
3. Nombre sugerido: `Air Fryer 365 Recetas`.
4. Seleccioná **Pagos online**, indicá que no usás una plataforma de e-commerce
   y elegí **Checkout Pro**.
5. Copiá el **Access Token de prueba** desde Credenciales de prueba. Nunca lo
   pongas en `index.html`, `script.js` ni en Git.

## 2. Configurar el proyecto

```powershell
Copy-Item .env.example .env
npm install
npm start
```

Editá `.env` y completá al menos:

- `MP_ACCESS_TOKEN`: token de prueba de la aplicación.
- `APP_BASE_URL`: URL HTTPS pública del sitio o del túnel local.
- `PRODUCT_PRICE` y `PRODUCT_CURRENCY`: deben coincidir con el precio visible.
  La cuenta argentina de Mercado Pago cobra normalmente en `ARS`; confirmá la
  moneda habilitada para tu cuenta antes de conservar el precio en `USD`.
- SMTP y `SELLER_EMAIL` para entregar el PDF por correo.
- `LINK_EXPIRATION_DAYS=30` para la vigencia del enlace.
- `DOWNLOAD_TOKEN_SECRET`: secreto largo y aleatorio independiente de las
  credenciales de Mercado Pago (obligatorio en producción).

Guardá el archivo a entregar como `digital/recetario.pdf`. Esa carpeta no es
pública: el servidor solo entrega el archivo mediante un enlace firmado que
vence. La firma permite validar el enlace después de reiniciar el servidor sin
guardar el token en memoria.

## 3. Configurar el webhook

En la aplicación, abrí **Webhooks > Configurar notificaciones**:

- URL de pruebas: `https://TU_URL/api/webhooks/mercadopago`
- Evento: **Pagos**
- Copiá la clave secreta generada a `MP_WEBHOOK_SECRET`.

En desarrollo, `APP_BASE_URL` puede ser una URL HTTPS de ngrok o Cloudflare
Tunnel. Mercado Pago debe poder acceder a esa URL desde Internet.

## 4. Probar

1. Usá credenciales y usuarios/tarjetas de prueba de Mercado Pago.
2. Pulsá **QUIERO MI RECETARIO**.
3. Aprobá el pago de prueba.
4. Verificá el webhook, el correo y el enlace de descarga.
5. Probá también un pago rechazado y uno pendiente: ninguno debe entregar el PDF.

El precio se toma del servidor, no del navegador. Después del webhook, el
servidor consulta el pago directamente a Mercado Pago y valida estado, monto,
moneda y producto antes de generar el enlace.

## 5. Salir a producción

- Publicá el sitio con HTTPS.
- Usá una base de datos para el historial de pagos y la idempotencia permanente
  de los webhooks. Los enlaces de descarga ya son firmados y no dependen de la
  memoria del proceso.
- Configurá la URL productiva del webhook y su clave secreta.
- Activá las credenciales productivas y cambiá `MP_ACCESS_TOKEN`.
- Definí `MP_ENVIRONMENT=production` y `NODE_ENV=production`.
- Ejecutá una compra real de monto bajo y comprobá la entrega completa.

No uses la página `gracias.html` ni los parámetros de retorno como prueba de
pago. La única confirmación válida es el pago `approved` consultado desde el
backend después de un webhook auténtico.

## 6. Desplegar en Cloudflare Workers

La versión de Cloudflare sirve el frontend con Workers Static Assets, ejecuta
la API en `worker.js`, guarda el PDF privado en R2 y registra las entregas en
D1. El servidor Express se conserva para desarrollo local.

### Preparar los recursos

```powershell
npm install
npx wrangler login
npx wrangler r2 bucket create buenas-recetas-private
npx wrangler d1 create buenas-recetas
```

Copiá el `database_id` devuelto por el último comando al binding `DB` de
`wrangler.jsonc`. Después aplicá el esquema y cargá el PDF privado:

```powershell
npx wrangler d1 migrations apply buenas-recetas --remote
npx wrangler r2 object put buenas-recetas-private/recetario.pdf --file digital/recetario.pdf --content-type application/pdf --remote
```

### Configurar secretos

Los secretos no se guardan en Git. Configuralos en Cloudflare o con:

```powershell
npx wrangler secret put MP_ACCESS_TOKEN
npx wrangler secret put MP_WEBHOOK_SECRET
npx wrangler secret put DOWNLOAD_TOKEN_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put SELLER_EMAIL
npx wrangler secret put SUPPORT_EMAIL
```

Para probar localmente, copiá `.dev.vars.example` como `.dev.vars` y completá
sus valores. `.dev.vars` está excluido de Git.

### Compilar y probar

```powershell
npm run build
npm run cf:dev
```

Para publicar manualmente:

```powershell
npm run cf:deploy
```

### Conectar GitHub

En Cloudflare abrí **Workers & Pages > Create application > Import a
repository**, autorizá tu cuenta de GitHub y elegí el repositorio
`MPCarranza/recetas-faciles`. El nombre del Worker debe ser
`buenas-recetas`, igual al campo `name` de `wrangler.jsonc`.

Usá estos comandos de compilación y despliegue:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

Agregá en **Settings > Variables and Secrets** los mismos secretos indicados
arriba. Finalmente conectá `buenasrecetas.com.ar` como dominio personalizado
del Worker y actualizá `APP_BASE_URL` con esa URL.
