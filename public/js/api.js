async function request(method, path, body) {
  const opts = { method, headers: {} };
  if (body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      if (body.errors) detail = body.errors.join(", ");
      else if (body.error) detail = body.error;
    } catch {}
    throw new Error(detail || `${method} ${path} failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const login = (data) => request("POST", "/auth/login", data);
export const getSession = () => request("GET", "/auth/me");
export const logout = () => request("POST", "/auth/logout");
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
