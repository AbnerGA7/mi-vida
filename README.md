# Mi Vida ðŸ“±

Mi app personal para ordenar mi vida desde el celular: **mi plata, mi cuerpo, mis papeles y mi dÃ­a**, con una IA que funciona **con y sin internet**.

![Expo](https://img.shields.io/badge/Expo-SDK%2058-000?style=for-the-badge&logo=expo)
![React Native](https://img.shields.io/badge/React%20Native-0.88-000?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-6-000?style=for-the-badge&logo=typescript)
![IA hÃ­brida](https://img.shields.io/badge/IA-Qwen%20local%20%2B%20Gemini-000?style=for-the-badge)

## Â¿QuÃ© hace?

| MÃ³dulo | QuÃ© hace | Estado |
|---|---|---|
| ðŸ” **Acceso** | Login con Google solo para mi correo + huella/PIN + base de datos cifrada | âœ… Listo |
| ðŸ¤– **IA hÃ­brida** | Qwen 2.5 3B dentro del celular sin internet, Gemini en la nube cuando hay seÃ±al | âœ… Listo |
| ðŸ’° **Asesor financiero** | Gastos en soles, presupuestos, metas de ahorro y alertas de pago | ðŸš§ Siguiente |
| ðŸ§  **Segundo cerebro** | Contratos, seguros y documentos; le pregunto "Â¿cuÃ¡ndo vence mi SOAT?" | â³ Pendiente |
| ðŸ’ª **Coach** | Rutinas de gym y menÃºs que se ajustan a mi progreso real | â³ Pendiente |
| ðŸ  **Panel de vida** | Agenda, correos y tareas; resumen cada maÃ±ana por notificaciÃ³n | â³ Pendiente |

## ðŸ” Seguridad

- **Solo yo entro:** el login con Google rechaza cualquier correo que no sea el mÃ­o.
- **Huella o PIN** al abrir la app y cada vez que vuelve de segundo plano.
- **Base de datos cifrada** con SQLCipher; la llave vive solo en el almacÃ©n seguro del celular.
- **Google en solo lectura:** Calendar y Gmail se leen, nunca se envÃ­a ni se borra nada.
- **Modo privado:** finanzas y documentos usan solo la IA local, asÃ­ que esos datos nunca salen del celular.

## ðŸ¤– CÃ³mo funciona la IA hÃ­brida

```
Â¿Hay internet y el dato no es privado?
   â”œâ”€ SÃ­ â†’ Gemini 2.5 Flash (nube, gratis)
   â”‚        â””â”€ si falla â†’ Qwen local
   â””â”€ No â†’ Qwen 2.5 3B (dentro del celular, gratis)
```

Las cuentas importantes (presupuestos, calorÃ­as, metas) se calculan **en cÃ³digo**, no con la IA, para que siempre salgan bien.

## ðŸš€ CÃ³mo correrla

Necesito Node 22+ y un Android con huella configurada. No funciona en Expo Go porque usa mÃ³dulos nativos (llama.rn, SQLCipher).

```bash
npm install
cp .env.example .env
npx expo run:android
```

### Variables de entorno (`.env`)

| Variable | De dÃ³nde sale |
|---|---|
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google Cloud â†’ Credenciales â†’ ID de cliente OAuth tipo Android (paquete `com.abnerga7.mivida`) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google Cloud â†’ ID de cliente OAuth tipo Web |
| `EXPO_PUBLIC_GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) (plan gratis) |

> En Google Cloud dejo la app OAuth en modo **Testing** con mi correo como usuario de prueba: los permisos de Gmail piden verificaciÃ³n de Google para uso pÃºblico.

## ðŸ—‚ï¸ Estructura

```
src/
â”œâ”€ app/                 pantallas (expo-router)
â”œâ”€ components/
â”‚  â””â”€ auth-gate.tsx     login con Google y pantalla de bloqueo
â””â”€ lib/
   â”œâ”€ config.ts         correo permitido, modelos y llaves
   â”œâ”€ session.tsx       sesiÃ³n y bloqueo automÃ¡tico
   â”œâ”€ secure-store.ts   sesiÃ³n y llave de cifrado
   â”œâ”€ auth/             Google y biometrÃ­a
   â”œâ”€ db/               SQLite cifrado y migraciones
   â””â”€ ai/               IA local, nube y modo hÃ­brido
```

## ðŸ›£ï¸ Hoja de ruta

- [x] Proyecto base, login con Google y huella
- [x] Base de datos local cifrada
- [x] IA hÃ­brida local + nube
- [x] Asesor financiero (registro rápido, presupuestos y balance)
- [ ] Segundo cerebro
- [ ] Coach de gym y alimentaciÃ³n
- [ ] Panel de vida y resumen matutino
