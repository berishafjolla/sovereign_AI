const BASE = "http://localhost:8000";

function getToken() {
  return localStorage.getItem("sai_token");
}

async function req(method, path, body, isForm = false) {
  const headers = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!isForm) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Auth
  register: (data) => req("POST", "/v1/auth/register", data),
  login: (data) => req("POST", "/v1/auth/login", data),
  me: () => req("GET", "/v1/auth/me"),

  // Datasets
  uploadDataset: (formData) => req("POST", "/v1/datasets/upload", formData, true),
  listDatasets: () => req("GET", "/v1/datasets"),
  getDataset: (id) => req("GET", `/v1/datasets/${id}`),
  updateDatasetMeta: (id, data) => req("PATCH", `/v1/datasets/${id}/metadata`, data),
  deleteDataset: (id) => req("DELETE", `/v1/datasets/${id}`),
  marketplace: () => req("GET", "/v1/datasets/marketplace"),

  // Policies
  generatePolicy: (data) => req("POST", "/v1/policies/generate", data),
  createPolicy: (data) => req("POST", "/v1/policies", data),
  listPolicies: () => req("GET", "/v1/policies"),
  getPolicy: (id) => req("GET", `/v1/policies/${id}`),
  updatePolicy: (id, data) => req("PATCH", `/v1/policies/${id}`, data),
  deletePolicy: (id) => req("DELETE", `/v1/policies/${id}`),

  // Bindings
  createBinding: (data) => req("POST", "/v1/bindings", data),
  listBindings: () => req("GET", "/v1/bindings"),
  togglePublish: (id) => req("PATCH", `/v1/bindings/${id}/publish`),
  revokeBinding: (id, data) => req("POST", `/v1/bindings/${id}/revoke`, data),

  // Requests
  submitRequest: (data) => req("POST", "/v1/requests", data),
  listMyRequests: () => req("GET", "/v1/requests"),
  listIncomingRequests: () => req("GET", "/v1/data-holder/requests"),
  approveRequest: (id) => req("POST", `/v1/requests/${id}/approve`),
  denyRequest: (id, data) => req("POST", `/v1/requests/${id}/deny`, data),
  bulkApprove: (ids) => req("POST", "/v1/requests/bulk-approve", { request_ids: ids }),
  bulkDeny: (ids, reason) => req("POST", "/v1/requests/bulk-deny", { request_ids: ids, reason }),

  // Exports
  createExport: (data) => req("POST", "/v1/export", data),
  listExports: () => req("GET", "/v1/exports"),
  downloadExport: async (id, filename) => {
    const token = getToken();
    const res = await fetch(`${BASE}/v1/exports/${id}/download`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Download failed");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `sovereignai_export_${id.slice(0, 8)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // GDPR
  gdprErasure: (data) => req("POST", "/v1/gdpr/erasure", data),
  gdprAccess: (data) => req("POST", "/v1/gdpr/access", data),
  gdprPortability: (data) => req("POST", "/v1/gdpr/portability", data),
  listGdprRequests: () => req("GET", "/v1/gdpr/requests"),

  // Audit
  auditLogs: () => req("GET", "/v1/audit/logs"),
  chainVerify: () => req("GET", "/v1/audit/chain-verify"),

  // Admin
  adminStats: () => req("GET", "/v1/admin/stats"),
  adminUsers: () => req("GET", "/v1/admin/users"),
  updateUser: (id, data) => req("PATCH", `/v1/admin/users/${id}`, data),
  notifications: () => req("GET", "/v1/admin/notifications"),
};
