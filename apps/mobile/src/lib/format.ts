const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatCents(cents: number): string {
  return brl.format(cents / 100);
}

/** Converte o que a pessoa digita ("12,5", "R$ 1.234,56") em centavos inteiros. */
export function parseCurrencyInput(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  if (!digits) return null;
  const cents = Number.parseInt(digits.slice(0, 9), 10);
  return Number.isFinite(cents) ? cents : null;
}

/** Máscara de moeda conforme a digitação: "2501" -> "25,01". */
export function maskCurrency(text: string): string {
  const cents = parseCurrencyInput(text);
  if (cents === null) return '';
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return 'ontem';
  if (d < 30) return `há ${d} dias`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function firstName(name: string): string {
  return name.split(' ')[0] ?? name;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase();
}
