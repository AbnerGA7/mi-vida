# Mi Vida 📱

Mi app personal para ordenar mi vida desde el celular: **mi plata, mi cuerpo, mis papeles y mi día**, con una IA que funciona **con y sin internet**.

![Expo](https://img.shields.io/badge/Expo-SDK%2058-000?style=for-the-badge&logo=expo)
![React Native](https://img.shields.io/badge/React%20Native-0.88-000?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-6-000?style=for-the-badge&logo=typescript)
![IA híbrida](https://img.shields.io/badge/IA-Qwen%20local%20%2B%20Gemini-000?style=for-the-badge)

## ¿Qué hace?

| Módulo | Qué hace | Estado |
|---|---|---|
| 🔐 **Acceso** | Login con Google solo para mi correo + huella/PIN + base de datos cifrada | ✅ Listo |
| 🤖 **IA híbrida** | Qwen 2.5 3B dentro del celular sin internet, Gemini en la nube cuando hay señal | ✅ Listo |
| 💰 **Asesor financiero** | Registro rápido ("25 menú con yape"), presupuestos con semáforo, metas de ahorro, pagos fijos con aviso y boletas con la cámara | ✅ Listo (v2) |
| 🧠 **Segundo cerebro** | Escaneo SOAT, DNI, contratos y pólizas (también PDF); le pregunto "¿cuándo vence mi SOAT?" y me avisa antes de que venza | ✅ Listo (v2) |
| 💪 **Coach** | Calorías y macros, rutina según mis días, registro de series, ajustes por progreso, gráficas y recordatorio semanal | ✅ Listo (v2) |
| 🏠 **Panel de vida** | Agenda, correos importantes, tareas y resumen cada mañana por notificación | ✅ Listo (v1) |

## 🏠 Panel de vida (pestaña Hoy)

- **Agenda de hoy** desde Google Calendar y **correos importantes sin leer** de las últimas 48 h desde Gmail, todo en solo lectura.
- **Tareas en una línea** con fechas en lenguaje natural, entendidas en código: "pagar luz el viernes!" crea la tarea para el próximo viernes con prioridad alta. También entiende "hoy", "mañana", "pasado mañana" y "15/03".
- **Resumen matutino:** junta mi agenda, tareas, presupuestos en riesgo, pagos fijos de los próximos 3 días, documentos por vencer y el gym de hoy. Llega como **notificación a las 7:00**.
  - Solo se reprograma si el texto cambió (guardo la huella SHA-256), y Google se reusa por 5 minutos al cambiar de pestaña; deslizar hacia abajo siempre recarga.
  - El texto se arma en el celular y se actualiza cada vez que abro la app, así que muestra los datos de la última vez que la abrí.
  - El token de Google dura ~1 hora: si venció, el panel me pide reconectar con un botón.

## 💰 Asesor financiero

- **Registro en una línea:** escribo "25 menú con yape" o "me pagaron 1200". Lo común se entiende al toque con palabras clave; lo raro lo interpreta la IA **local** (mis finanzas nunca salen del celular).
- **Presupuestos con semáforo:** 🟢 vas bien, 🟡 en riesgo (gastas más rápido que el avance del mes), 🔴 excedido. También muestra la proyección al cierre del mes.
- **Boletas con la cámara:** le tomo foto a la boleta y leo en código el total (no el subtotal ni el IGV), el comercio, la fecha y la categoría por tienda (Tottus, Inkafarma, Primax…). Me pide confirmar antes de guardar y la foto se borra.
- **Pagos fijos:** alquiler, luz o tarjeta con su día del mes. Me avisa **la noche anterior y la mañana del día**, y muestra cuánto vence esta semana.
- **Metas de ahorro:** cuánto llevo, cuánto falta y **cuánto guardar al mes** para llegar a la fecha. Toco una meta para abonar o retirar.
- **Movimientos del mes:** mantengo presionado uno para borrarlo.
- Todas las cuentas se hacen **en código**, no con la IA.

## 🧠 Segundo cerebro

- **Escaneo con la cámara** o subo una imagen, texto o PDF. El texto se lee con **OCR de ML Kit dentro del celular**.
- **Clasificación por reglas primero:** unos 30 tipos de documento peruanos (SOAT, brevete, DNI, contratos, recibos, SUNAT…) se reconocen en código al instante. Solo si las reglas dudan entra la **IA local**, con un esquema JSON que no la deja inventar categorías. Los escaneos se renombran con su tipo ("SOAT 24/10/2026").
- La **fecha de vencimiento** se detecta en código: `15/03/2027`, `2027-03-15`, `15-MAR-2027`, "31 de dic. 2026", "marzo 15, 2027", y corrijo errores típicos del OCR ("2O27"). Cada fecha recibe un puntaje según las palabras cercanas ("vence", "hasta" suman; "emisión", "nacimiento" restan). Si solo encuentro el inicio y sé cuánto dura (el SOAT, 1 año), calculo el fin.
- **Respuestas al instante:** "¿cuándo vence mi SOAT?", "¿está vigente mi brevete?", "¿qué vence pronto?" se responden en código con la fecha guardada, sin IA.
- **Preguntas con fuente:** para lo demás busco con FTS5 (con sinónimos y más peso al nombre) y le paso a la IA solo los trozos relevantes; la respuesta aparece mientras se escribe y cita de dónde sacó el dato.
- **Alertas** de lo vencido o lo que vence en menos de 30 días, y **notificaciones 30, 7 y 1 día antes** de cada vencimiento.
- **PDF:** cada página se convierte en imagen y pasa por el OCR dentro del celular; si casi no sale texto, me pregunta si puede leerlo con Gemini.
- Los archivos se guardan en el almacenamiento privado de la app, no en la galería.

## 💪 Coach de gym y alimentación

- **Mis números:** calorías con Mifflin-St Jeor × factor de actividad, ajustadas a mi objetivo (−18% para bajar grasa, +7% para ganar masa). Proteína de 2-2.2 g/kg, grasa de 0.9 g/kg y el resto en carbohidratos.
- **Rutina según mis días:** cuerpo completo (2-3 días), torso/pierna (4) o empuje/jalón/pierna (5-6). Si tengo una lesión (rodilla, espalda, hombro), cambio los ejercicios de riesgo por alternativas seguras.
- **Sesión de hoy:** registro peso y repeticiones por serie y veo lo que hice la última vez.
- **Registro semanal con reglas en código:**
  - Peso estancado 2 semanas → ±150 kcal (sale de los carbohidratos).
  - Energía o sueño bajos → menos volumen.
  - Un ejercicio sin progreso en 3 sesiones → cambiarlo o bajar a 3×10.
  - Si escribo "mareo" o "dolor agudo" → no subo cargas y me recomienda ir al médico.
- **Mi progreso:** gráficas de las últimas 8 semanas con mi peso promedio y el volumen que levanto (kg × repeticiones).
- **Recordatorio semanal** cada domingo a las 6 pm para hacer el registro.
- **Menú peruano del día** generado con IA según mis macros y lo que no como.

## 🔐 Seguridad

- **Solo yo entro:** el login con Google rechaza cualquier correo que no sea el mío.
- **Huella o PIN** al abrir la app y cada vez que vuelve de segundo plano.
- **Base de datos cifrada** con SQLCipher; la llave vive solo en el almacén seguro del celular.
- **Google en solo lectura:** Calendar y Gmail se leen, nunca se envía ni se borra nada.
- **Modo privado:** finanzas y documentos usan solo la IA local, así que esos datos nunca salen del celular.

## 🤖 Cómo funciona la IA híbrida

```
¿Hay internet y el dato no es privado?
   ├─ Sí → Gemini Flash (nube, gratis; alias gemini-flash-latest)
   │        └─ si falla → Qwen local
   └─ No → Qwen 2.5 3B (dentro del celular, gratis)
```

**La IA local se descarga desde la pestaña ⚙️ Ajustes** (~2 GB, una sola vez y mejor con Wi-Fi). Antes de bajarla reviso que haya espacio libre, y la descarga va a un archivo temporal para que una descarga cortada nunca quede como modelo listo. En Ajustes también puedo probar la IA (híbrida o solo local), ver cuánto tarda y borrar el modelo.

## 🚀 Cómo correrla

Necesito Node 22+ y un Android con huella configurada. No funciona en Expo Go porque usa módulos nativos (llama.rn, SQLCipher).

```bash
npm install
cp .env.example .env
npx expo run:android
```

### Variables de entorno (`.env`)

| Variable | De dónde sale |
|---|---|
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google Cloud → Credenciales → ID de cliente OAuth tipo Android (paquete `com.abnerga7.mivida`) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google Cloud → ID de cliente OAuth tipo Web |
| `EXPO_PUBLIC_GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) (plan gratis) |

> En Google Cloud dejo la app OAuth en modo **Testing** con mi correo como usuario de prueba: los permisos de Gmail piden verificación de Google para uso público.

## 🗂️ Estructura

```
src/
├─ app/
│  ├─ index.tsx         pantalla Hoy (panel de vida)
│  ├─ finanzas.tsx      pantalla Mi plata
│  ├─ cerebro.tsx       pantalla Segundo cerebro
│  ├─ coach.tsx         pantalla Coach
│  └─ ajustes.tsx       descarga de la IA local, pruebas y cuenta
├─ components/
│  └─ auth-gate.tsx     login con Google y pantalla de bloqueo
└─ lib/
   ├─ config.ts         correo permitido, modelos y llaves
   ├─ session.tsx       sesión y bloqueo automático
   ├─ secure-store.ts   sesión y llave de cifrado
   ├─ tasks.ts          tareas con fechas en lenguaje natural
   ├─ brief.ts          resumen del día y notificación de las 7 am
   ├─ google/           Calendar y Gmail en solo lectura
   ├─ auth/             Google y biometría
   ├─ db/               SQLite cifrado y migraciones
   ├─ ai/               IA local, nube y modo híbrido
   ├─ finance/          presupuestos, consultas y registro rápido
   ├─ brain/            escaneo, OCR, fechas y preguntas a mis documentos
   └─ coach/            macros, rutinas, reglas de ajuste y menú
```

## 🛣️ Hoja de ruta

- [x] Proyecto base, login con Google y huella
- [x] Base de datos local cifrada
- [x] IA híbrida local + nube
- [x] Asesor financiero v1 (registro rápido, presupuestos y balance)
- [ ] Asesor financiero v2 (metas de ahorro, alertas de pago, leer boletas con la cámara)
- [x] Segundo cerebro v1 (escaneo, OCR, vencimientos y preguntas con fuente)
- [ ] Segundo cerebro v2 (leer texto de PDF y notificaciones de vencimiento)
- [x] Coach v1 (macros, rutina, series, registro semanal y menú)
- [ ] Coach v2 (gráficas de progreso y recordatorio semanal)
- [x] Panel de vida v1 (agenda, correos, tareas y resumen a las 7 am)
- [ ] Resumen que se recalcula en segundo plano antes de las 7 am
- [ ] Asistente central: un chat que consulta los 4 módulos
