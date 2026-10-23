// Calendar y Gmail en solo lectura con el token de mi login de Google.

export type Evento = { id: string; titulo: string; inicio: string; fin: string; todoElDia: boolean; enlace?: string };
export type Correo = { id: string; de: string; asunto: string; fragmento: string };

async function google<T>(token: string, url: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new Error('TOKEN_EXPIRADO');
  if (!res.ok) throw new Error(`Google respondió ${res.status}`);
  return res.json();
}

export async function todayEvents(token: string, today = new Date()): Promise<Evento[]> {
  const desde = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const hasta = new Date(desde.getTime() + 86400000);
  const params = new URLSearchParams({
    timeMin: desde.toISOString(),
    timeMax: hasta.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '20',
  });
  const data = await google<{ items?: any[] }>(
    token,
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
  );
  return (data.items ?? []).map((e) => ({
    id: e.id,
    titulo: e.summary ?? '(sin título)',
    inicio: e.start?.dateTime ?? e.start?.date,
    fin: e.end?.dateTime ?? e.end?.date,
    todoElDia: !e.start?.dateTime,
    enlace: e.hangoutLink,
  }));
}

// Correos sin leer de las últimas 48 h que Gmail marca como importantes.
export async function importantEmails(token: string): Promise<Correo[]> {
  const q = encodeURIComponent('is:unread is:important newer_than:2d -category:promotions -category:social');
  const list = await google<{ messages?: { id: string }[] }>(
    token,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=8`,
  );
  const ids = (list.messages ?? []).map((m) => m.id);
  return Promise.all(
    ids.map(async (id) => {
      const m = await google<any>(
        token,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
      );
      const header = (name: string) => m.payload?.headers?.find((h: any) => h.name === name)?.value ?? '';
      return {
        id,
        de: header('From').replace(/<.*>/, '').replace(/"/g, '').trim(),
        asunto: header('Subject') || '(sin asunto)',
        fragmento: m.snippet ?? '',
      };
    }),
  );
}

export function horaCorta(iso: string) {
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}
