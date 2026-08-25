export function formatDate(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}
