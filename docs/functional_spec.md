# Especificación Funcional — MusicDibs Enterprise

**Versión:** 1.0  
**Fecha:** 2026-05-29  
**Propietario del producto:** iCommunity / MusicDibs  
**Estado:** Documento vivo — actualizar con cada release mayor

---

## Tabla de contenidos

1. [Descripción del producto](#1-descripción-del-producto)
2. [Usuarios y roles](#2-usuarios-y-roles)
3. [Casos de uso principales](#3-casos-de-uso-principales)
4. [Inventario de pantallas](#4-inventario-de-pantallas)
5. [Flujos principales](#5-flujos-principales)
6. [Problemas UX actuales](#6-problemas-ux-actuales)
7. [Design System](#7-design-system)
8. [Arquitectura técnica](#8-arquitectura-técnica)
9. [Variables de entorno](#9-variables-de-entorno)
10. [Roadmap por fases](#10-roadmap-por-fases)

---

## 1. Descripción del producto

### 1.1 Visión general

MusicDibs Enterprise es una plataforma SaaS B2B de email marketing que diferencia las campañas de sus clientes mediante canciones generadas por inteligencia artificial. Cada campaña de email incluye una pieza musical única, creada bajo demanda a partir del contexto de la campaña (vertical de negocio, objetivo, tono e idioma), sin que el cliente tenga que gestionar nada relacionado con la generación de audio.

El modelo de negocio es **llave en mano**: MusicDibs opera su propia cuenta de KIE.ai (vía Suno) y absorbe toda la complejidad de la generación musical. El cliente únicamente necesita conectar su proveedor de mailing habitual (MailerLite o Brevo) mediante una API key y gestionar sus listas de contactos.

### 1.2 Propuesta de valor

- **Diferenciación**: las campañas llegan al inbox con una experiencia sonora personalizada, aumentando el engagement y el tiempo de interacción.
- **Sin fricción técnica**: el cliente no necesita conocimientos de IA ni acceso directo a plataformas de generación de audio.
- **Integración con stacks existentes**: compatible con MailerLite y Brevo, herramientas ya adoptadas por la mayoría de los clientes objetivo.
- **Multitenant y multi-rol**: diseñado para equipos de marketing de distintos tamaños, con control granular de permisos.
- **Trazabilidad y auditoría**: cada acción queda registrada, permitiendo a los superadmins detectar problemas y actuar proactivamente.

### 1.3 Modelo de servicio

| Elemento | Responsable |
|---|---|
| Generación de música (KIE.ai / Suno) | MusicDibs (cuenta propia) |
| Envío de emails | Tenant (su API key de MailerLite o Brevo) |
| Almacenamiento de audio | Supabase Storage (gestionado por MusicDibs) |
| Facturación y planes | Stripe (gestionado por MusicDibs) |
| Infraestructura | Supabase (PostgreSQL, Edge Functions, Auth) |

---

## 2. Usuarios y roles

### 2.1 Matriz de roles

| Rol | Scope | Descripción |
|---|---|---|
| **Superadmin** | Global | Personal de iCommunity/MusicDibs. Gestiona todos los tenants, configura la plataforma globalmente e impersona cuentas para soporte. |
| **Admin de tenant** | Organización | Propietario o administrador de la organización cliente. Gestiona campañas, contactos, equipo, facturación y configuración completa. |
| **Manager** | Organización | Miembro del equipo con capacidad de crear y gestionar campañas y contactos. Sin acceso a settings de la organización ni facturación. |
| **Analyst** | Organización | Acceso de solo lectura. Puede ver métricas, campañas y reportes, pero no puede crear ni modificar nada. |

### 2.2 Permisos por módulo

| Módulo | Superadmin | Admin | Manager | Analyst |
|---|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Campañas — ver | ✅ | ✅ | ✅ | ✅ |
| Campañas — crear/editar | ✅ | ✅ | ✅ | ❌ |
| Campañas — eliminar | ✅ | ✅ | ❌ | ❌ |
| Contactos — ver | ✅ | ✅ | ✅ | ✅ |
| Contactos — crear/editar/eliminar | ✅ | ✅ | ✅ | ❌ |
| Analytics | ✅ | ✅ | ✅ | ✅ |
| Team — ver | ✅ | ✅ | ✅ | ❌ |
| Team — gestionar | ✅ | ✅ | ❌ | ❌ |
| Settings | ✅ | ✅ | ❌ | ❌ |
| Billing | ✅ | ✅ | ❌ | ❌ |
| Audit Log | ✅ | ✅ | ❌ | ❌ |
| Admin Panel | ✅ | ❌ | ❌ | ❌ |

---

## 3. Casos de uso principales

### CU01 — Crear y lanzar campaña de email con canción generada por IA

**Actor principal:** Admin o Manager  
**Precondición:** Tenant tiene proveedor de mailing configurado con API key válida y al menos una lista de contactos.

**Flujo principal:**
1. El usuario navega a Campaigns y pulsa "Nueva campaña".
2. El wizard de 5 pasos se abre:
   - **Paso 1 — Contexto**: tipo de campaña, vertical de negocio, objetivo (goal), tono e idioma.
   - **Paso 2 — Música**: proveedor AI (KIE.ai por defecto), estilo musical y duración del clip.
   - **Paso 3 — Canal**: selección del proveedor de mailing (MailerLite / Brevo) y lista de contactos.
   - **Paso 4 — Email**: asunto del email y configuración del mensaje.
   - **Paso 5 — Revisión**: resumen completo antes de lanzar.
3. El usuario confirma el lanzamiento.
4. El sistema encola un job de generación en KIE.ai.
5. La generación ocurre de forma asíncrona; el job aparece en GenerationQueue con estado `pending` → `processing` → `completed` o `failed`.
6. Una vez completada la generación, el audio queda disponible en CampaignDetail para revisión.
7. El usuario aprueba el audio y confirma el envío.
8. El sistema envía la campaña a través del proveedor de mailing configurado.
9. El sistema registra el evento en AuditLog.

**Flujos alternativos:**
- A1: Job de generación falla → el sistema permite reintentar manualmente o ajustar parámetros del prompt.
- A2: API key del proveedor de mailing inválida → el sistema muestra error en el paso 3 y redirige a Settings.

**Postcondición:** Campaña en estado `sent` con audio asociado; métricas disponibles tras sincronización.

---

### CU02 — Importar y gestionar lista de contactos

**Actor principal:** Admin o Manager  
**Precondición:** Usuario autenticado con rol Admin o Manager.

**Flujo principal:**
1. El usuario navega a Contacts.
2. Puede crear contactos manualmente (formulario) o importar desde CSV.
3. El sistema valida el CSV (columnas mínimas: email, nombre).
4. Los contactos válidos se importan y quedan disponibles.
5. El usuario puede crear listas, asignar contactos a listas y editar o eliminar contactos existentes.
6. Las listas quedan disponibles en el paso 3 del CampaignBuilder.

**Flujos alternativos:**
- A1: CSV con filas inválidas → el sistema muestra un resumen de errores y permite continuar con los registros válidos.
- A2: Email duplicado → el sistema avisa y omite el duplicado.

---

### CU03 — Configurar proveedor de mailing

**Actor principal:** Admin  
**Precondición:** Usuario autenticado con rol Admin.

**Flujo principal:**
1. El Admin navega a Settings → sección API Keys.
2. Selecciona el proveedor (MailerLite o Brevo).
3. Introduce la API key del proveedor.
4. El sistema valida la API key realizando una llamada de prueba al proveedor.
5. Si la validación es exitosa, la key se guarda de forma cifrada.
6. El proveedor configurado queda disponible en el CampaignBuilder.

**Flujos alternativos:**
- A1: API key inválida → el sistema muestra el error devuelto por el proveedor y no guarda la key.

---

### CU04 — Ver métricas de campaña

**Actor principal:** Admin, Manager o Analyst  
**Precondición:** Al menos una campaña enviada.

**Flujo principal:**
1. El usuario navega a Analytics o a CampaignDetail de una campaña específica.
2. El sistema muestra las métricas disponibles:
   - Open rate (%)
   - Click rate (%)
   - Coste estimado de generación (USD)
   - Número de destinatarios
3. El usuario puede forzar una sincronización manual con el proveedor de mailing para actualizar las métricas.
4. Las métricas se actualizan también automáticamente al cargar la página.

**Flujos alternativos:**
- A1: El proveedor de mailing no devuelve datos → el sistema muestra el último valor conocido con indicador de "datos desactualizados".

---

### CU05 — Gestionar equipo y roles

**Actor principal:** Admin  
**Precondición:** Usuario autenticado con rol Admin.

**Flujo principal:**
1. El Admin navega a Team.
2. Puede invitar a un nuevo miembro introduciendo su email y asignándole un rol (Manager o Analyst).
3. El invitado recibe un email de invitación y completa su registro.
4. El Admin puede cambiar el rol de un miembro existente o eliminar su acceso.
5. Todas las acciones quedan registradas en AuditLog.

**Flujos alternativos:**
- A1: El email ya pertenece a un usuario del tenant → el sistema avisa y no duplica la invitación.
- A2: El plan del tenant no permite más usuarios → el sistema bloquea la invitación y sugiere actualizar el plan.

---

### CU06 — Superadmin: gestionar tenant

**Actor principal:** Superadmin  
**Precondición:** Usuario autenticado con rol Superadmin.

**Flujo principal:**
1. El Superadmin navega a Admin Panel → pestaña Tenants.
2. Visualiza la lista de tenants con health score, plan y estado de onboarding.
3. Entra en el detalle de un tenant (/admin/tenants/:id):
   - Ve el health score y el checklist de onboarding completado.
   - Revisa campañas, jobs de generación, listas de contactos y equipo del tenant.
   - Lee y añade notas internas sobre el tenant.
   - Visualiza el historial de actividad.
4. Puede cambiar el plan del tenant (upgrade/downgrade).
5. Puede pulsar "Impersonar" para acceder a la cuenta del tenant como si fuera su Admin.
6. Todas las acciones de impersonación quedan registradas en AuditLog con el actor real.

**Postcondición:** El estado del tenant queda actualizado; notas e impersonaciones registradas.

---

### CU07 — Superadmin: cambiar modelo KIE.ai sin redeploy

**Actor principal:** Superadmin  
**Precondición:** Usuario autenticado con rol Superadmin.

**Flujo principal:**
1. El Superadmin navega a Admin Panel → pestaña Platform Config.
2. Visualiza la configuración actual del modelo KIE.ai (versión, parámetros por defecto).
3. Modifica la versión del modelo o los parámetros globales.
4. Guarda los cambios; estos se aplican inmediatamente a todos los jobs nuevos sin necesidad de redeploy.

**Postcondición:** Nuevos jobs de generación utilizan la configuración actualizada.

---

### CU08 — Superadmin: detectar y actuar sobre tenants en riesgo de churn

**Actor principal:** Superadmin  
**Precondición:** El sistema ha calculado el health score de los tenants.

**Flujo principal:**
1. El Superadmin accede al Admin Panel → Tenants.
2. El sistema resalta visualmente los tenants con health score bajo (umbral configurable).
3. El Superadmin entra en el detalle del tenant en riesgo.
4. Revisa el checklist de onboarding (qué pasos faltan), la actividad reciente y las campañas creadas.
5. Añade una nota interna con el plan de acción.
6. Opcionalmente impersona la cuenta para diagnosticar problemas directamente.
7. Puede contactar al tenant a través del canal externo (email, CRM).

**Postcondición:** Nota de intervención registrada; health score se recalcula en la siguiente ejecución.

---

## 4. Inventario de pantallas

### 4.1 Pantallas públicas

| Pantalla | Ruta | Estado | Descripción |
|---|---|---|---|
| Landing | `/` | ✅ Completa | Página de presentación del producto, CTA de registro. |
| Login | `/login` | ✅ Completa | Autenticación con email/contraseña vía Supabase Auth. |
| Signup | `/signup` | ✅ Completa | Registro de nuevo tenant con email/contraseña. |
| Onboarding | `/onboarding` | ✅ Completa | Wizard post-registro: nombre de empresa, vertical de negocio. |

### 4.2 Pantallas de tenant (autenticadas)

| Pantalla | Ruta | Estado | Descripción |
|---|---|---|---|
| Dashboard | `/dashboard` | ✅ Completa | KPIs: campañas totales, contactos, miembros del equipo, actividad reciente. |
| Campaigns (lista) | `/campaigns` | ✅ Completa | Listado de campañas con filtros por estado, búsqueda y ordenación. |
| CampaignBuilder | `/campaigns/new` | ✅ Completa | Wizard de 5 pasos para crear campañas: tipo, vertical, goal, tono, idioma, estilo musical, duración, canal, lista de contactos, asunto. |
| CampaignDetail | `/campaigns/:id` | ✅ Completa | Detalle de campaña: estado, stats (open rate, click rate, coste), audio player, jobs de generación, configuración completa. |
| GenerationQueue | `/generation-queue` | ✅ Completa | Cola de jobs de generación con estado en tiempo real (polling). Permite reintentar jobs fallidos. |
| Analytics | `/analytics` | ✅ Completa | KPIs agregados con sync automático al cargar y sync manual forzado. |
| Contacts | `/contacts` | ✅ Completa | CRUD de contactos y listas. Importación CSV. Asignación de contactos a listas. |
| Settings | `/settings` | ✅ Completa | Perfil de organización, selector de proveedor de mailing (MailerLite / Brevo) con campo API key. |
| Team | `/team` | ✅ Completa | Gestión de miembros: invitación, cambio de rol, eliminación. |
| Developers | `/developers` | ✅ Completa | Documentación de la API REST y SDK de MusicDibs Enterprise. Ejemplos de integración. |
| AuditLog | `/audit-log` | ✅ Completa | Historial de todas las acciones realizadas en el tenant, con actor, acción, recurso y timestamp. |

### 4.3 Pantallas de superadmin

| Pantalla | Ruta | Estado | Descripción |
|---|---|---|---|
| Admin Panel | `/admin` | ✅ Completo | Panel central con cuatro pestañas: Tenants, Platform Config, Jobs Monitor, Audit Log global. |
| Admin Tenant Detail | `/admin/tenants/:id` | ✅ Completa | Vista 360 por tenant: health score, checklist de onboarding, campañas, jobs, listas, equipo, notas internas, actividad. Botón "Impersonar". |

### 4.4 Componentes transversales

| Componente | Estado | Descripción |
|---|---|---|
| Sidebar | ✅ Completo | Navegación principal. Colapso en desktop. Sin soporte mobile aún. |
| Audio Player | ✅ Completo | Reproductor embebido en CampaignDetail para previsualizar el audio generado. |
| Modales de confirmación | ✅ Completos | Confirmación de acciones destructivas (eliminar campaña, contacto, miembro). |
| Toast / notificaciones inline | ✅ Completos | Feedback de operaciones CRUD y errores de API. |
| Dark Mode Toggle | ✅ Completo | Alterna clase `dark` en `<html>`; persiste en localStorage. |

---

## 5. Flujos principales

### Flujo 1 — Primer uso (onboarding)

```
Signup → Onboarding (nombre empresa + vertical)
  → Settings: configurar proveedor mailing + API key
  → Contacts: importar contactos CSV → crear lista
  → CampaignBuilder: crear primera campaña
  → Dashboard
```

### Flujo 2 — Crear y enviar campaña

```
Campaigns → "Nueva campaña"
  → Wizard paso 1: tipo, vertical, goal, tono, idioma
  → Wizard paso 2: estilo musical, duración
  → Wizard paso 3: proveedor mailing, lista de contactos
  → Wizard paso 4: asunto del email
  → Wizard paso 5: revisión → Lanzar
  → [Job encolado] → GenerationQueue (pending → processing → completed)
  → CampaignDetail: revisar audio → Aprobar → Enviar
  → Analytics: métricas disponibles tras sync
```

### Flujo 3 — Sincronización de métricas

```
Analytics (carga automática al entrar)
  → Sistema llama a API del proveedor de mailing
  → Métricas se actualizan en base de datos
  → UI muestra KPIs actualizados
  [Opcional: usuario pulsa "Sincronizar ahora" para sync manual]
```

### Flujo 4 — Superadmin: gestión y soporte de tenant

```
Admin Panel → Tenants (lista con health scores)
  → Tenant con score bajo → Admin Tenant Detail
  → Revisar checklist + actividad + campañas
  → Añadir nota interna
  → [Opcional] Impersonar → acceso completo como Admin del tenant
  → AuditLog registra la sesión de impersonación
```

### Flujo 5 — Generación fallida y reintento

```
CampaignDetail / GenerationQueue → Job en estado "failed"
  → Usuario revisa el motivo del error
  → Pulsa "Reintentar"
  → Nuevo job encolado → ciclo de generación normal
```

---

## 6. Problemas UX actuales

Los siguientes problemas han sido identificados y están pendientes de resolución en fases futuras del roadmap:

| ID | Severidad | Área | Descripción |
|---|---|---|---|
| UX-01 | Alta | Onboarding | El wizard de onboarding es plano y no guía al usuario de forma visual paso a paso. No hay indicador de progreso ni ayudas contextuales. |
| UX-02 | Media | CampaignBuilder | El wizard tiene demasiados pasos sin previsualización del resultado final (no se muestra cómo quedará el email con la canción). |
| UX-03 | Alta | Mobile | La sidebar no es colapsable en dispositivos móviles. Las tablas requieren scroll horizontal. El diseño no está optimizado para viewports estrechos. |
| UX-04 | Alta | GenerationQueue | No hay feedback visual en tiempo real del progreso de generación. El usuario debe refrescar manualmente o depender del polling. |
| UX-05 | Media | Analytics | Las métricas no se actualizan en tiempo real (no hay WebSocket/realtime). El sync automático al cargar puede estar desactualizado durante la sesión. |
| UX-06 | Media | Notificaciones | No hay notificaciones push cuando la canción generada está lista. El usuario no sabe cuándo volver a la campaña. |
| UX-07 | Media | CampaignBuilder | Los formularios no tienen autoguardado. Si el usuario cierra el wizard sin lanzar, pierde todo el draft. |
| UX-08 | Baja | Design | Inconsistencia visual entre algunos modales y las páginas principales (tipografía, espaciado, colores de fondo). |

---

## 7. Design System

### 7.1 Tipografía

| Rol | Fuente | Uso |
|---|---|---|
| Display / Headings | **Fraunces** (serif) | Títulos de página, heroes, headings h1–h3 |
| Body / Sans | **Syne** (sans-serif) | Texto de párrafo, labels, navegación, UI general |
| Código | **JetBrains Mono** (monospace) | Bloques de código, tokens, JSON, logs |

### 7.2 Paleta de colores

#### Colores primarios

| Nombre | Valor HEX | Uso |
|---|---|---|
| Gold principal | `#C9973A` | CTAs primarios, highlights, iconos de acción |
| Gold dark | `#8C5E0A` | Hover states de Gold, texto sobre fondo claro |
| Teal principal | `#2BB5A0` | Accents, badges de estado activo, links |
| Teal dark | `#0D7A64` | Hover states de Teal, bordes activos |

#### Neutros

| Nombre | Uso |
|---|---|
| **Sand** | Backgrounds claros, cards en light mode |
| **Night** | Backgrounds oscuros, dark mode base |

#### Semánticos

| Color | Uso |
|---|---|
| Verde éxito | Estado `completed`, confirmaciones |
| Rojo error | Estado `failed`, alertas críticas |
| Amarillo advertencia | Alertas de onboarding incompleto, health score bajo |
| Gris neutro | Estados deshabilitados, texto secundario |

### 7.3 Dark Mode

- Implementado con clase `dark` en el elemento `<html>`.
- El toggle persiste la preferencia en `localStorage`.
- Todos los componentes tienen variantes dark mode definidas con Tailwind (`dark:` prefix).

### 7.4 Componentes

- **Approach**: Tailwind CSS utility-first. No se usa librería de componentes externa; todos los componentes son custom.
- **Iconos**: Tabler Icons — clase `ti ti-{nombre}` para todos los iconos de la interfaz.
- **Animaciones**: `fade-in` y `slide-up` definidas como clases de utilidad en la configuración de Tailwind.

### 7.5 Layout

- Sidebar fija en desktop (colapsable a modo icono).
- Contenido principal con padding responsivo.
- Grid de KPIs en dashboard: 4 columnas en desktop, 2 en tablet, 1 en mobile (en progreso para mobile).
- Tablas con scroll horizontal en viewports < 768px (pendiente rediseño mobile-first).

---

## 8. Arquitectura técnica

### 8.1 Stack completo

| Capa | Tecnología | Versión / Notas |
|---|---|---|
| Frontend | React | 18.x |
| Bundler | Vite | — |
| Lenguaje | TypeScript | Strict mode |
| Estilos | Tailwind CSS | Utility-first, sin componentes externos |
| Backend / DB | Supabase PostgreSQL | Multitenancy via RLS (Row Level Security) |
| Backend / API | Supabase Edge Functions | Deno runtime, TypeScript |
| Autenticación | Supabase Auth | JWT, magic links, email/password |
| Almacenamiento | Supabase Storage | Audio generado, assets de campaña |
| Billing | Stripe | Subscripciones, webhooks |
| Generación de audio | KIE.ai (Suno) | Cuenta propia de MusicDibs |
| Mailing | MailerLite / Brevo | API key del tenant |

### 8.2 Modelo de multitenancy

- Cada tenant tiene un `organization_id` que se propaga como campo en todas las tablas.
- Row Level Security (RLS) de Supabase garantiza que cada tenant solo accede a sus propios datos.
- El Superadmin tiene políticas RLS especiales que le permiten acceder a todos los tenants.
- La impersonación se gestiona mediante un JWT de sesión especial que incluye el `organization_id` del tenant impersonado y el `user_id` real del Superadmin, para mantener la trazabilidad en AuditLog.

### 8.3 Flujo de generación de audio

```
CampaignBuilder → Supabase Edge Function (create-generation-job)
  → Inserta job en tabla generation_jobs (estado: pending)
  → Llama a KIE.ai API con los parámetros del prompt
  → KIE.ai procesa de forma asíncrona
  → Webhook / polling actualiza el estado del job
  → Audio URL guardada en Supabase Storage
  → CampaignDetail disponible para revisión
```

### 8.4 Flujo de envío de email

```
CampaignDetail → Aprobación de audio → Supabase Edge Function (send-campaign)
  → Recupera API key del tenant (MailerLite o Brevo)
  → Construye el payload del email con el audio embebido/enlazado
  → Llama a la API del proveedor de mailing
  → Actualiza estado de campaña a "sent"
  → Registra evento en AuditLog
```

### 8.5 Modelo de datos principal (tablas clave)

| Tabla | Descripción |
|---|---|
| `organizations` | Tenants. Contiene plan, vertical, configuración. |
| `profiles` | Usuarios. Vinculados a `auth.users` de Supabase. |
| `organization_members` | Relación usuario ↔ organización con rol. |
| `campaigns` | Campañas. Estado, configuración del prompt, métricas. |
| `generation_jobs` | Jobs de KIE.ai. Estado, parámetros, URL del audio resultante. |
| `contacts` | Contactos de un tenant. |
| `contact_lists` | Listas de contactos. |
| `contact_list_members` | Relación contacto ↔ lista. |
| `audit_logs` | Registro de todas las acciones con actor, acción, recurso y timestamp. |
| `platform_config` | Configuración global de la plataforma (modelo KIE.ai, parámetros, etc.) — solo accesible por Superadmin. |

### 8.6 Integración con Stripe

- Plans y precios definidos en el dashboard de Stripe.
- Webhooks de Stripe actualizan el estado de suscripción en `organizations`.
- El billing está accesible únicamente para Admin de tenant y Superadmin.
- El Superadmin puede cambiar el plan de un tenant desde el Admin Panel.

---

## 9. Variables de entorno

Las siguientes variables de entorno son necesarias para el funcionamiento de la plataforma. Las marcadas como **Supabase Edge Functions** se configuran en el dashboard de Supabase; las marcadas como **Frontend** se incluyen en el `.env` del proyecto Vite.

### 9.1 Frontend (Vite / `.env`)

| Variable | Descripción |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave pública (anon) de Supabase |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Clave pública de Stripe |

### 9.2 Supabase Edge Functions (secrets)

| Variable | Descripción |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio de Supabase (operaciones admin) |
| `KIE_AI_API_KEY` | API key de la cuenta KIE.ai de MusicDibs |
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret para validar webhooks de Stripe |
| `MAILERLITE_API_KEY` | (Opcional) API key por defecto para tests de integración |
| `BREVO_API_KEY` | (Opcional) API key por defecto para tests de integración |

> **Nota de seguridad:** Las API keys de mailing de los tenants (MailerLite / Brevo) se guardan cifradas en la base de datos y se desencriptan en Edge Functions en tiempo de ejecución. Nunca se exponen al frontend.

---

## 10. Roadmap por fases

### Fase 1 — Fundaciones ✅ Completada

Cubre la implementación inicial de todos los módulos core de la plataforma.

| Módulo | Estado |
|---|---|
| Autenticación (Supabase Auth) | ✅ |
| Multitenancy con RLS | ✅ |
| Dashboard con KPIs | ✅ |
| Campañas CRUD | ✅ |
| CampaignBuilder wizard (5 pasos) | ✅ |
| Generación de audio con KIE.ai | ✅ |
| Envío de mailing (MailerLite / Brevo) | ✅ |
| Analytics con sync manual y automático | ✅ |
| Contacts y listas | ✅ |
| Team y gestión de roles | ✅ |
| Settings (perfil, API keys) | ✅ |
| Audit Log | ✅ |
| Admin Panel (Superadmin) | ✅ |
| Billing con Stripe | ✅ |
| SDK / API Developers | ✅ |

### Fase 2 — Visibilidad operacional 🔄 En progreso

Mejoras para que el equipo de MusicDibs pueda gestionar clientes de forma proactiva.

| Módulo | Estado |
|---|---|
| Admin Tenant Detail (vista 360) | 🔄 |
| Health score por tenant | 🔄 |
| Churn alerts automáticas | 🔄 |
| Notas internas por tenant | 🔄 |
| Impersonación de cuentas | 🔄 |
| Platform Config (modelo KIE.ai, parámetros globales) | 🔄 |

### Fase 3 — Experiencia avanzada ⬜ Pendiente

Mejoras de producto orientadas a la retención de clientes y nuevas capacidades.

| Módulo / Mejora | Prioridad estimada |
|---|---|
| Notificaciones push cuando la canción está lista | Alta |
| Realtime updates (WebSocket) en GenerationQueue y Analytics | Alta |
| Mobile-first redesign (sidebar colapsable, tablas responsivas) | Alta |
| Autoguardado de drafts en CampaignBuilder | Media |
| NotificationCenter completo (centro de notificaciones en app) | Media |
| Canal WhatsApp (además de email) | Media |
| `pg_cron` para retry automático de jobs fallidos | Media |
| Flujo de verificación del email del remitente | Media |
| A/B testing de campañas (asunto, música) | Media |
| Templates de prompt predefinidos por vertical | Media |
| iBS blockchain certificate (certificado de autenticidad del audio) | Baja |
| Webhook outbound para integraciones CRM | Baja |
| Corrección de inconsistencias de diseño (modales vs. páginas) | Baja |

---

## Apéndice A — Glosario

| Término | Definición |
|---|---|
| **Tenant** | Organización cliente que usa MusicDibs Enterprise. |
| **Job** | Tarea asíncrona de generación de audio en KIE.ai. |
| **Health Score** | Puntuación calculada por el sistema que indica el grado de adopción y actividad de un tenant. Se usa para detectar riesgo de churn. |
| **Impersonación** | Acceso de un Superadmin a la cuenta de un tenant como si fuera su Admin, para soporte y diagnóstico. |
| **KIE.ai** | Plataforma de generación de música por IA (basada en Suno) utilizada por MusicDibs. |
| **Vertical** | Sector de negocio del tenant (ej.: hostelería, moda, retail, educación). Define el contexto del prompt de generación musical. |
| **RLS** | Row Level Security — mecanismo de Supabase PostgreSQL que garantiza el aislamiento de datos entre tenants. |
| **Proveedor de mailing** | Servicio externo de envío de emails del tenant: MailerLite o Brevo. |

---

*Documento generado el 2026-05-29. Para actualizaciones, editar este archivo y registrar los cambios con fecha y descripción en el historial de commits del repositorio.*
