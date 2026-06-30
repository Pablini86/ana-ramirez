# Panel de Ana — guía de instalación

Esta carpeta (`apps-script/`) contiene el backend del panel admin. No se publica en el sitio; es el código que va a vivir en Google Apps Script. Sigue estos pasos una sola vez.

## 1. Token de GitHub (para que el panel pueda guardar cambios)

1. Ve a https://github.com/settings/personal-access-tokens/new (token "fine-grained").
2. Repository access → **Only select repositories** → `ana-ramirez`.
3. Permissions → Repository permissions → **Contents: Read and write** y **Actions: Read and write**. Nada más.
4. Genera el token y cópialo (solo se muestra una vez). Guárdalo en un lugar seguro temporalmente. Vas a usar este mismo token dos veces (pasos 3 y 6).

## 2. Crear el proyecto de Apps Script

1. Ve a https://script.google.com → **Nuevo proyecto**.
2. Nómbralo "Panel de Ana".
3. En el editor, borra el contenido de `Code.gs` y pega el de este repo (`apps-script/Code.gs`).
4. Crea un archivo HTML nuevo llamado `Index` (Archivo → Nuevo → Archivo HTML) y pega el contenido de `apps-script/Index.html`.
5. Click en el ícono de engranaje ⚙️ (Configuración del proyecto) → activa **"Mostrar el archivo de manifiesto 'appsscript.json' en el editor"**. Abre ese archivo y reemplaza su contenido con `apps-script/appsscript.json` de este repo.

## 3. Configurar las propiedades del script

En el editor: ⚙️ **Configuración del proyecto** → sección **Propiedades del script** → agrega estas (nombre / valor):

| Propiedad | Valor |
|---|---|
| `GITHUB_TOKEN` | el token que generaste en el paso 1 |
| `GITHUB_OWNER` | `Pablini86` |
| `GITHUB_REPO` | `ana-ramirez` |
| `GITHUB_BRANCH` | `main` |
| `SITE_BASE_URL` | `https://anaballesteros.site/` |
| `ALLOWED_EMAILS` | correo de Ana y el tuyo, separados por coma |
| `DRIVE_PENDING_FOLDER_ID` | ver paso 4 |

El token nunca debe pegarse en el código ni compartirse en chat — solo va aquí.

## 4. Carpeta de Drive para videos crudos

1. En Google Drive, crea una carpeta llamada por ejemplo "Ana — videos pendientes".
2. Comparte esa carpeta con la cuenta de Ana (Editor) para que pueda subir videos.
3. Clic derecho → **Compartir** → **Acceso general** → cambia a **"Cualquier persona con el enlace"** → rol **Lector**. Esto evita errores de permisos al publicar (sin esto, "Publicar" puede fallar con "Acceso denegado" si quien sube el video y quien publica son cuentas distintas).
4. Ábrela y copia el ID de la URL: `https://drive.google.com/drive/folders/`**`ESTE_ID`**.
5. Pega ese ID en la propiedad `DRIVE_PENDING_FOLDER_ID` del paso 3.

## 5. Secret de GitHub para publicar videos automáticamente

1. En GitHub, entra al repo `ana-ramirez` → **Settings** → **Secrets and variables** → **Actions**.
2. **New repository secret**.
3. Nombre: `PUBLISH_TOKEN`. Valor: el mismo token del paso 1.
4. Guardar.

Esto permite que el botón "Publicar" del panel comprima y suba el video automáticamente (vía GitHub Actions), sin que tengas que pedírmelo en el chat.

## 6. Publicar como aplicación web

1. En el editor: **Implementar** → **Nueva implementación**.
2. Tipo: **Aplicación web**.
3. "Ejecutar como": **Usuario que accede a la aplicación web**.
4. "Quién tiene acceso": **Cualquier usuario** (esto significa cualquiera con cuenta de Google, pero el panel revisa internamente que el correo esté en `ALLOWED_EMAILS` — si no está, ve un mensaje de "sin acceso").
5. Implementar → autoriza los permisos que pida (Drive, y conexión externa a GitHub) → copia la URL de la app web.
6. Abre tú primero esa URL para probar que el panel carga bien.
7. Comparte la URL con Ana. Ella entra con su cuenta de Google y ya puede usarlo — sin contraseñas nuevas.

## Cómo funciona una vez instalado

- **Mostrar/ocultar, reordenar, cambiar etiquetas, logos, fotos del sitio**: se guardan al instante directo en el repo de GitHub. El sitio se actualiza solo en ~1 minuto (GitHub Pages se reconstruye automáticamente).
- **Subir un video nuevo**: Ana lo sube desde el panel (sin comprimir, tal cual lo grabó). Se guarda en la carpeta de Drive del paso 4 y aparece en la pestaña "Pendientes" del panel con estatus "procesando". El video **no aparece en el sitio todavía**.
- **Publicar un video pendiente**: tú decides cuándo, dando clic en "Publicar" dentro de la pestaña "Pendientes" del panel — no necesitas pedírmelo en el chat. Eso dispara un GitHub Action que descarga el video de Drive, lo comprime y lo agrega a la sección correspondiente automáticamente (tarda 1-3 minutos). Puedes ver el progreso en la pestaña **Actions** del repo en GitHub.
- Si una subida de video falla a medio camino (conexión inestable), Ana puede simplemente intentar de nuevo.
- Videos crudos muy pesados (varios cientos de MB) pueden tardar varios minutos en subir o fallar por el navegador del celular — si pasa, pídele que intente desde wifi o que lo recorte un poco.

## Mantenimiento

- El token de GitHub no expira a menos que tú le pongas fecha de expiración al crearlo — si lo expiras, el panel deja de poder guardar cambios hasta que generes uno nuevo.
- Para agregar o quitar quién tiene acceso, edita `ALLOWED_EMAILS` en las propiedades del script.
