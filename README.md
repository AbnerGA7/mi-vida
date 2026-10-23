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
| 💰 **Asesor financiero** | Registro rápido ("25 menú con yape"), balance del mes y presupuestos con semáforo | ✅ Listo (v1) |
| 🧠 **Segundo cerebro** | Escaneo SOAT, DNI, contratos y pólizas; le pregunto "¿cuándo vence mi SOAT?" | ✅ Listo (v1) |
| 💪 **Coach** | Calorías y macros, rutina según mis días, registro de series y ajustes por progreso | ✅ Listo (v1) |
| 🏠 **Panel de vida** | Agenda, correos y tareas; resumen cada mañana por notificación | ⏳ Pendiente |

## 💰 Asesor financiero

- **Registro en una línea:** escribo "25 menú con yape" o "me pagaron 1200". Lo común se entiende al toque con palabras clave; lo raro lo interpreta la IA **local** (mis finanzas nunca salen del celular).
- **Presupuestos con semáforo:** 🟢 vas bien, 🟡 en riesgo (gastas más rápido que el avance del mes), 🔴 excedido. También muestra la proyección al cierre del mes.
- **Movimientos del mes:** mantengo presionado uno para borrarlo.
- Todas las cuentas se hacen **en código**, no con la IA.

## 🧠 Segundo cerebro

- **Escaneo con la cámara** o subo una imagen, texto o PDF. El texto se lee con **OCR de ML Kit dentro del celular**.
- La **IA local** lo clasifica (Seguros, Contratos, Identidad, Salud, Vehículos…) y escribe un resumen de una línea.
- La **fecha de vencimiento** se detecta en código (formatos `15/03/2027`, `2027-03-15` y "31 de diciembre de 2026"), priorizando la que aparece cerca de "vence", "vigencia" o "hasta".
- **Preguntas con fuente:** busco con FTS5 los documentos más relevantes y la IA responde citando de cuál sacó el dato. Si no está, me dice qué subir.
- **Alertas** de lo vencido o lo que vence en menos de 30 días.
- Los archivos se guardan en el almacenamiento privado de la app, no en la galería. Los PDF se guardan pero aún no se leen: para eso los escaneo.

## 💪 Coach de gym y alimentación

- **Mis números:** calorías con Mifflin-St Jeor × factor de actividad, ajustadas a mi objetivo (−18% para bajar grasa, +7% para ganar masa). Proteína de 2-2.2 g/kg, grasa de 0.9 g/kg y el resto en carbohidratos.
- **Rutina según mis días:** cuerpo completo (2-3 días), torso/pierna (4) o empuje/jalón/pierna (5-6). Si tengo una lesión (rodilla, espalda, hombro), cambio los ejercicios de riesgo por alternativas seguras.
- **Sesión de hoy:** registro peso y repeticiones por serie y veo lo que hice la última vez.
- **Registro semanal con reglas en código:**
  - Peso estancado 2 semanas → ±150 kcal (sale de los carbohidratos).
  - Energía o sueño bajos → menos volumen.
  - Un ejercicio sin progreso en 3 sesiones → cambiarlo o bajar a 3×10.
  - Si escribo "mareo" o "dolor agudo" → no subo cargas y me recomienda ir al médico.
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
   ├─ Sí → Gemini 2.5 Flash (nube, gratis)
   │        └─ si falla → Qwen local
   └─ No → Qwen 2.5 3B (dentro del celular, gratis)
```

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
│  ├─ finanzas.tsx      pantalla Mi plata
│  ├─ cerebro.tsx       pantalla Segundo cerebro
│  └─ coach.tsx         pantalla Coach
├─ components/
│  └─ auth-gate.tsx     login con Google y pantalla de bloqueo
└─ lib/
   ├─ config.ts         correo permitido, modelos y llaves
   ├─ session.tsx       sesión y bloqueo automático
   ├─ secure-store.ts   sesión y llave de cifrado
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
- [ ] Panel de vida y resumen matutino
