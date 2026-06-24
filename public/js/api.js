async function request(method, path, body) {
  const opts = { method, headers: {} };
  if (body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

export const fetchEvents = () => request("GET", "/events");
export const fetchEvent = (id) => request("GET", `/event/${id}`);
export const createEvent = (data) => request("POST", "/addEvent", data);
export const removeEvent = (id) => request("DELETE", `/event/${id}`);

export async function uploadImage(formData) {
  const res = await fetch("/uploadImage", { method: "POST", body: formData });
  if (!res.ok) throw new Error(`Image upload failed: ${res.status}`);
  const ct = res.headers.get("Content-Type");
  return ct === "application/json" ? (await res.json()).url : res.text();
}
