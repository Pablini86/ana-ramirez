# Ana Ballesteros — sitio de portafolio UGC

Sitio en producción: **[anaballesteros.site](https://anaballesteros.site)**

## Qué es esto

Este es el sitio de portafolio de **Ana Ballesteros**, creadora de contenido UGC (User Generated Content) y editora de video. Lo construí para ella como proyecto personal: necesitaba un lugar profesional donde mostrar su trabajo (UGC a cámara, marca personal, videos de marca sin locución), sus tarifas y sus redes, sin depender de un linktree genérico ni de un template que no pudiera mantener ella misma.

La prioridad al diseñarlo fue que **Ana pudiera actualizar su propio contenido sin tocar código ni pedirme ayuda cada vez** — subir un video nuevo, ocultar uno viejo, cambiar una tarifa o el texto de una sección. Por eso el sitio no es solo HTML estático: tiene un panel de administración por detrás.

## Cómo funciona (arquitectura)

```
Visitante → anaballesteros.site (GitHub Pages, HTML estático)
                     ↑ lee
                 data.json  ← fuente de verdad del contenido (textos, videos, logos, fotos)
                     ↑ escribe
     Panel de Ana (Google Apps Script, con su cuenta de Google)
                     ↓ dispara
        GitHub Actions (comprime video con ffmpeg + genera poster + hace commit)
```

- **Frontend** (`index.html`): un solo archivo estático, sin build step ni framework de JS pesado. Usa un pequeño runtime de plantillas propio (`support.js`, generado — no se edita a mano) que hace binding de `{{ variable }}` contra un objeto de datos, similar en espíritu a JSX pero sin necesidad de compilar nada para publicarlo. Todo el CSS vive embebido en el propio HTML.
- **Contenido** (`data.json`): textos, fotos, y las listas de video/logos con su etiqueta, orden y visibilidad. El HTML tiene además una copia de respaldo (`DEFAULT_SITE_DATA`) por si `data.json` no carga.
- **Panel admin** (`apps-script/`): vive fuera del sitio, corre como Google Apps Script. Ana entra con su cuenta de Google (sin contraseñas nuevas que recordar), y desde ahí puede mostrar/ocultar contenido, reordenarlo, cambiar textos y fotos, y subir videos nuevos. El acceso está limitado por correo (`ALLOWED_EMAILS`). Instrucciones de instalación completas en [`apps-script/SETUP.md`](apps-script/SETUP.md).
- **Publicación de video** (`.github/workflows/publicar-video.yml` + `scripts/publish_pending_video.py`): cuando Ana sube un video crudo desde el panel, se guarda en Drive como "pendiente". Al darle "Publicar", se dispara un GitHub Action que descarga el video, lo comprime con `ffmpeg`, genera automáticamente una miniatura (poster) del primer frame, y hace commit directo al repo. GitHub Pages reconstruye el sitio solo, en ~1 minuto.

### Por qué esta arquitectura y no un CMS tradicional

No hay presupuesto ni necesidad de un backend con base de datos para un sitio de portafolio con tráfico bajo. `data.json` versionado en git ya da historial de cambios gratis, GitHub Pages es gratis y confiable, y Google Apps Script evita tener que hostear y mantener un backend propio solo para el panel de administración. El costo de esta simplicidad es que todo el contenido (incluyendo textos y organización del portafolio) queda en un repo público — ver la nota de privacidad más abajo.

## Estructura del repo

```
index.html          El sitio completo (markup + CSS + lógica de render)
data.json            Contenido editable: textos, fotos, videos, logos, orden/visibilidad
manifest.json         PWA — permite "instalar" el sitio en celular
support.js           Runtime de plantillas (generado, no editar a mano)
CNAME                 Dominio custom para GitHub Pages
fotos/                Fotos de Ana usadas en el sitio
logos/                Logos de marcas con las que ha colaborado
videos/               Videos del portafolio + su miniatura (poster) .jpg
scripts/               publish_pending_video.py — usado por el GitHub Action de publicación
apps-script/           Backend del panel de Ana (Google Apps Script) + guía de instalación
.github/workflows/     Automatización: publicar un video pendiente
```

## Desarrollo local

No requiere build ni dependencias. Basta con servir la carpeta con cualquier servidor estático, por ejemplo:

```bash
python3 -m http.server 8080
# abrir http://localhost:8080/index.html
```

(Abrir `index.html` directo con doble clic / `file://` no funciona del todo: el `fetch('data.json')` que carga el contenido lo bloquea el navegador por CORS en ese protocolo.)

## Privacidad

El repo es **público**. No contiene tokens ni credenciales (el token de GitHub y los correos con acceso al panel viven únicamente en las Propiedades del Script de Apps Script, nunca en el código — ver `apps-script/SETUP.md`). Sí contiene todas las fotos y videos que Ana ha decidido mostrar en su portafolio público, así que no hay contenido ahí que no esté ya destinado a ser público.

---

Hecho por Pablo para Ana.
