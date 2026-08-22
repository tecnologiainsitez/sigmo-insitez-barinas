# 🚀 Guía Completa de Despliegue a Costo $0/mes

Sigue esta guía paso a paso para poner en marcha el sistema con Google Sheets, Google Apps Script y hosting frontend gratuito (Vercel, Netlify o GitHub Pages).

---

## PASO 1: Crear la Base de Datos Central en Google Sheets

1. Ve a [Google Sheets](https://sheets.new) y crea una nueva hoja de cálculo en blanco.
2. Nómbrala: **`BD_CitasMedicas_CentroSalud`**.
3. Renombra la primera pestaña como **`Usuarios`** y crea las siguientes 3 pestañas:
   - **`Citas`**
   - **`Medicos`**
   - **`Especialidades`**
4. Agrega los encabezados exactos en la fila 1 de cada pestaña:

   - **`Usuarios`**:
     `ID_Usuario | Nombre | Email | PasswordHash | Rol | Estado | UltimoAcceso`
   - **`Citas`**:
     `ID_Cita | Paciente | Cedula | Email | Telefono | Medico | Especialidad | Fecha | Hora | Estado | HistoriaMedica | MotivoConsulta | CreadoPor | Fecha_Registro_UTC`
   - **`Medicos`**:
     `ID_Medico | Nombre | Especialidad | HorarioAtencion | Consultorio | Telefono | Email | Estado`
   - **`Especialidades`**:
     `ID_Especialidad | Nombre_Especialidad | Descripcion`

*(Nota: Si dejas las pestañas vacías, el script `Code.gs` creará automáticamente los encabezados y usuarios semilla en la primera ejecución).*

---

## PASO 2: Implementar el Backend Serverless en Google Apps Script

1. En tu hoja de Google Sheets, ve al menú superior: **Extensiones > Apps Script**.
2. Borra el código por defecto en `Código.gs`.
3. Pega el contenido completo del archivo **`Code.gs`**.
4. Guarda el proyecto con el nombre: **`API_CitasMedicas`**.

### Configurar Notificaciones por Webhook de Google Chat (Opcional):
- En el editor de Apps Script, ve a **Configuración del Proyecto (icono de engranaje) > Propiedades del Script**.
- Agrega una nueva propiedad:
  - Clave: `GOOGLE_CHAT_WEBHOOK`
  - Valor: *(La URL de webhook entrante creada en tu espacio de Google Chat)*.

---

## PASO 3: Publicar Google Apps Script como Web App (API REST)

1. En la esquina superior derecha del editor de Apps Script, haz clic en **Implementar > Nueva implementación**.
2. Haz clic en el engranaje **Seleccionar tipo** y elige **Aplicación web**.
3. Completa los campos:
   - **Descripción**: `v1.0 Producción API REST Citas`
   - **Ejecutar como**: `Yo (tu correo electrónico)`
   - **Quién tiene acceso**: **`Cualquier usuario`** *(Imprescindible para permitir llamadas desde el frontend web).*
4. Haz clic en **Implementar** y autoriza los permisos de Google Workspace (acceso a Sheets y MailApp para correos).
5. **Copia la URL de la aplicación web** generada (termina en `/exec`).

---

## PASO 4: Desplegar el Frontend Web Estático (Costo $0/mes)

El frontend consta únicamente de 2 archivos estáticos: `index.html` y `app.js`. Puedes alojarlo gratis en cualquiera de estas opciones:

### Opción A: GitHub Pages
1. Crea un repositorio en GitHub (ej. `citas-medicas-offline`).
2. Sube `index.html` y `app.js`.
3. Ve a **Settings > Pages > Branch: main / (root)** y guarda.
4. Tu sistema estará en vivo en: `https://tu-usuario.github.io/citas-medicas-offline`.

### Opción B: Vercel / Netlify
1. Arrastra la carpeta con `index.html` y `app.js` a [app.netlify.com/drop](https://app.netlify.com/drop) o impórtala en [Vercel](https://vercel.com).
2. Obtendrás un dominio HTTPS instantáneo con soporte offline PWA y Service Worker.

---

## PASO 5: Conectar el Frontend con el Backend

1. Abre tu aplicación web desplegada.
2. Inicia sesión como Administrador (**`admin@salud.com`** / **`salud123`**).
3. Dirígete a la pestaña **Gestión de Usuarios (Admin)**.
4. En el panel inferior **Configuración de Conexión Serverless**, pega la **URL de Apps Script Web App** obtenida en el Paso 3.
5. ¡Listo! Las citas agendadas localmente en IndexedDB se sincronizarán automáticamente con tu Google Sheets, enviando emails con `.ics` y notificaciones interactivas a Google Chat.
