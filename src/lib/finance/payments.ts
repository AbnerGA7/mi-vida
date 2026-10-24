// Pagos fijos de cada mes (alquiler, luz, tarjeta): fechas calculadas en código.

export type Payment = {
  id: number;
  nombre: string;
  monto: number;
  // Día del mes en que vence (1-31). Si el mes es más corto, vence el último día.
  dia: number;
};

export type UpcomingPayment = Payment & { fecha: string; dias: number };

const pad = (n: number) => String(n).padStart(2, '0');
const DIA_MS = 24 * 60 * 60 * 1000;

function fechaDelMes(y: number, m: number, dia: number) {
  const ultimo = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(dia, ultimo));
}

// La próxima vez que vence: este mes si todavía no pasó (hoy cuenta), si no el siguiente.
export function nextDueDate(dia: number, hoy = new Date()) {
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  let f = fechaDelMes(base.getFullYear(), base.getMonth(), dia);
  if (f < base) f = fechaDelMes(base.getFullYear(), base.getMonth() + 1, dia);
  return `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`;
}

export function upcomingPayments(pagos: Payment[], hoy = new Date(), dentroDe = 7): UpcomingPayment[] {
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
  return pagos
    .map((p) => {
      const fecha = nextDueDate(p.dia, hoy);
      const [y, m, d] = fecha.split('-').map(Number);
      return { ...p, fecha, dias: Math.round((new Date(y, m - 1, d).getTime() - base) / DIA_MS) };
    })
    .filter((p) => p.dias <= dentroDe)
    .sort((a, b) => a.dias - b.dias || b.monto - a.monto);
}

export type PaymentReminder = { pagoId: number; cuando: Date; titulo: string; texto: string };

const formato = (monto: number) => `S/ ${monto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Aviso la noche anterior (para tener la plata lista) y la mañana del día, en los próximos dos meses.
export function planPaymentReminders(pagos: Payment[], ahora = new Date()): PaymentReminder[] {
  const avisos: PaymentReminder[] = [];
  for (const p of pagos) {
    let desde = ahora;
    for (let vez = 0; vez < 2; vez++) {
      const [y, m, d] = nextDueDate(p.dia, desde).split('-').map(Number);
      const vispera = new Date(y, m - 1, d - 1, 19, 0);
      const mismoDia = new Date(y, m - 1, d, 9, 0);
      if (vispera > ahora) {
        avisos.push({ pagoId: p.id, cuando: vispera, titulo: `💳 Mañana pagas ${p.nombre}`, texto: `${formato(p.monto)} · ten la plata lista.` });
      }
      if (mismoDia > ahora) {
        avisos.push({ pagoId: p.id, cuando: mismoDia, titulo: `💳 Hoy vence ${p.nombre}`, texto: `${formato(p.monto)} · regístralo en Mi plata cuando pagues.` });
      }
      desde = new Date(y, m - 1, d + 1);
    }
  }
  return avisos.sort((a, b) => a.cuando.getTime() - b.cuando.getTime());
}
