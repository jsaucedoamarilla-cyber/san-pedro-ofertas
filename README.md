# SAN PEDRO OFERTAS

Marketplace PWA adaptable a celulares y computadoras para publicar y descubrir productos y servicios en Paraguay.

## Funciones incluidas

- Navegación y búsqueda de publicaciones aprobadas sin iniciar sesión.
- Registro e inicio de sesión mediante Google o Facebook (Firebase Authentication).
- Perfil de vendedor con nombre, ciudad, foto y WhatsApp.
- Publicaciones con foto, precio, categoría, descripción, departamento, ciudad y WhatsApp.
- Revisión y aprobación manual de publicaciones por el administrador.
- Comentarios y consultas debajo de cada publicación; solo usuarios con sesión activa pueden comentar.
- Contacto directo con el vendedor por WhatsApp y opción de compartir anuncios.
- Solicitudes de publicaciones destacadas con comprobante de transferencia o giro:
  - 30 días: Gs. 30.000
  - 20 días: Gs. 20.000
  - 10 días: Gs. 10.000
  - 5 días: Gs. 5.000
- Panel de administración: aprobar anuncios, revisar comprobantes, activar destacados, eliminar anuncios y fotos, moderar comentarios, suspender/reactivar integrantes y eliminar sus datos de la plataforma.
- Contacto del administrador: Juan Saucedo — WhatsApp 0984 36 35 98.
- PWA instalable y caché con actualización de archivos.

## Importante antes de usar datos reales

El repositorio incluye el código y las reglas, pero **no incluye la configuración de tu proyecto Firebase**. `firebase-config.js` contiene valores de ejemplo. Hasta que se coloquen los valores reales, la web funciona únicamente en modo demostración con publicaciones de muestra; no guarda usuarios, anuncios ni comentarios reales.

## Configuración de Firebase

1. Crear o abrir un proyecto en Firebase Console.
2. Agregar una aplicación web y copiar la configuración web a `firebase-config.js`.
3. En Authentication → Sign-in method, habilitar Google y Facebook. Facebook también requiere configurar una aplicación en Meta y copiar los datos OAuth que Firebase solicita.
4. En Authentication → Settings → Authorized domains, agregar el dominio donde se publicará la web (por ejemplo, el dominio `github.io`).
5. Crear Firestore Database y Storage.
6. Publicar las reglas de este repositorio:
   - Firestore: `firestore.rules`
   - Storage: `storage.rules`
7. Iniciar sesión una vez con la cuenta que será administradora. En Firestore, crear manualmente la colección `admins` y un documento cuyo ID sea exactamente el UID de esa cuenta. El documento puede contener `{ "role": "admin" }`.
8. No crear documentos en `admins` para vendedores. Ese documento concede permisos administrativos.

### Publicar reglas con Firebase CLI

Instalar Firebase CLI, iniciar sesión y seleccionar el proyecto correcto. Luego ejecutar:

```bash
firebase deploy --only firestore:rules,storage
```

## Publicar en GitHub Pages

1. Subir el contenido de este proyecto a la raíz de la rama `main`.
2. En GitHub → Settings → Pages, elegir **GitHub Actions** como método de publicación.
3. El flujo `.github/workflows/pages.yml` publicará el sitio cuando se actualice `main` o al ejecutarlo manualmente.
4. Completar `firebase-config.js` con los datos del proyecto Firebase y volver a subir el archivo.

## Administración y eliminación de cuentas

El botón **Eliminar integrante** elimina los datos del perfil dentro de esta plataforma, sus anuncios, comentarios, fotos y comprobantes, y bloquea el acceso a la aplicación con estado `deleted`. La eliminación de la cuenta subyacente de Google o Facebook (Firebase Authentication) requiere una función backend administrativa o eliminarla desde Firebase Console; el navegador no puede borrar de forma segura la cuenta de autenticación de otra persona.

## APK Android

Este proyecto es una PWA. Puede instalarse desde el navegador compatible. Todavía no es un APK Android compilado. Antes de empaquetarlo como APK hay que completar y probar Firebase y luego preparar el envoltorio Android (por ejemplo, Capacitor).

## Seguridad y pruebas

- Revisar las reglas en Firebase Emulator antes de abrir el sitio al público.
- No publicar credenciales privadas, contraseñas ni archivos de service account.
- La configuración web Firebase no reemplaza las reglas de seguridad.
- Los pagos no se procesan dentro de la app: el administrador verifica manualmente cada comprobante antes de activar el destacado.
- La suspensión y eliminación lógica bloquean el acceso a la plataforma; no eliminan por sí solas una identidad externa de Google/Facebook.
