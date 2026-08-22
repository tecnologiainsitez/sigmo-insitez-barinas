# Estructura de Base de Datos en Google Sheets (INSITEZ 1.0)

**ID Oficial de Hoja de Cálculo:** `1imBh1z83rce_CyWl_9jIxe7vY6gGN2M6G5DkOhbcGKc`  
**Enlace directo:** [https://docs.google.com/spreadsheets/d/1imBh1z83rce_CyWl_9jIxe7vY6gGN2M6G5DkOhbcGKc/edit](https://docs.google.com/spreadsheets/d/1imBh1z83rce_CyWl_9jIxe7vY6gGN2M6G5DkOhbcGKc/edit)

---

## ⚡ Auto-Configuración en 1 Clic
El script `Code.gs` incluye la función `setupDatabaseSheets()` y el menú institucional en Google Sheets `🏥 INSITEZ - Salud Integral > ⚡ Auto-configurar todas las Hojas y Tablas`. Al ejecutarse, creará y dará formato automáticamente a las siguientes 7 pestañas:

---

### 1. Pestaña `Pacientes` (Padrón de Beneficiarios UNELLEZ)
| Columna | Nombre Campo | Tipo de Dato | Descripción / Regla |
|---|---|---|---|
| **A** | `Cedula` | Texto / Numérico | Clave primaria nacional (ej. `0801199512345`) |
| **B** | `NombreCompleto` | Texto | Nombre y apellidos del afiliado |
| **C** | `Condicion` | Enum | `DOCENTE` \| `ADMINISTRATIVO` \| `OBRERO` \| `ESTUDIANTE` \| `JUBILADO` \| `BENEFICIARIO` |
| **D** | `Cargo` | Texto | Cargo desempeñado o estatus |
| **E** | `Dependencia` | Texto | Vicerrectorado / Dirección / Departamento |
| **F** | `Parentesco` | Enum | `TITULAR` \| `HIJO_A` \| `CONYUGE` \| `PADRE_MADRE` |
| **G** | `TitularCedula` | Texto | Cédula del titular responsable de la carga |
| **H** | `TitularNombre` | Texto | Nombre del titular afiliado |
| **I** | `Email` | Texto | Correo electrónico para notificaciones |
| **J** | `Telefono` | Texto | Teléfono de contacto |
| **K** | `Direccion` | Texto | Dirección domiciliaria |
| **L** | `Estado` | Enum | `ACTIVO` \| `INACTIVO` |
| **M** | `FechaRegistro` | ISO-8601 | Fecha y hora de afiliación |

---

### 2. Pestaña `Citas` (Historial Clínico de Citas)
| Columna | Nombre Campo | Tipo de Dato | Descripción / Regla |
|---|---|---|---|
| **A** | `ID_Cita` | Texto UUID | Identificador único (`CITA-001`) |
| **B** | `Paciente` | Texto | Nombre completo del paciente |
| **C** | `Cedula` | Texto | Cédula del paciente |
| **D** | `Email` | Texto | Correo para envío de `.ics` |
| **E** | `Telefono` | Texto | Número de contacto |
| **F** | `Medico` | Texto | Especialista asignado |
| **G** | `Especialidad` | Texto | Especialidad médica u odontológica |
| **H** | `Fecha` | `YYYY-MM-DD` | Fecha de la consulta |
| **I** | `Hora` | `HH:MM` | Hora fijada de la cita |
| **J** | `Estado` | Enum | `CONFIRMED` \| `IN_WAITING_ROOM` \| `ATTENDED` \| `CANCELLED` |
| **K** | `HistoriaMedica` | Texto | Antecedentes clínicos / Alergias |
| **L** | `MotivoConsulta` | Texto | Razón de la consulta |
| **M** | `CreadoPor` | Texto | Usuario analista o médico |
| **N** | `Fecha_Registro_UTC`| ISO-8601 | Timestamp para sincronización offline |

---

### 3. Pestaña `Medicos` (Directorio de Especialistas)
| Columna | Nombre Campo | Tipo de Dato |
|---|---|---|
| **A** | `ID_Medico` | `DOC-001` |
| **B** | `Nombre` | Nombre del Dr(a). |
| **C** | `Especialidad` | Especialidad médica |
| **D** | `HorarioAtencion` | `08:00 - 14:00` |
| **E** | `Consultorio` | Ubicación / Consultorio |
| **F** | `Telefono` | Teléfono |
| **G** | `Email` | Correo institucional |
| **H** | `Estado` | `ACTIVO` / `INACTIVO` |

---

### 4. Pestaña `Especialidades`
* `ID_Especialidad`, `Nombre_Especialidad`, `Descripcion`

### 5. Pestaña `Usuarios` (Control de Acceso RBAC)
* `ID_Usuario`, `Nombre`, `Email`, `PasswordHash`, `Rol`, `Estado`, `UltimoAcceso`

### 6. Pestaña `Configuracion`
* `Parametro`, `Valor`, `Descripcion`, `UltimaActualizacion`

### 7. Pestaña `Logs_Notificaciones`
* `ID_Log`, `ID_Cita`, `Tipo`, `Destinatario`, `Asunto_Titulo`, `Estado`, `Timestamp`, `Detalles`
