export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export function createApiClient(
  baseUrl: string | undefined,
  getToken: () => string | null = () => null,
) {
  return async function api<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    if (!baseUrl)
      throw new ApiError("API non configurée.", 0, "NOT_CONFIGURED");
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("://"))
      throw new ApiError("Chemin API invalide.", 0, "INVALID_PATH");
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");
    if (options.body && !(options.body instanceof FormData))
      headers.set("Content-Type", "application/json");
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      ...options,
      headers,
    });
    if (response.status === 204) return undefined as T;
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error =
        payload && typeof payload === "object" && "error" in payload
          ? payload.error
          : null;
      const data =
        error && typeof error === "object"
          ? (error as Record<string, unknown>)
          : {};
      throw new ApiError(
        typeof data.message === "string"
          ? data.message
          : "Le service est indisponible.",
        response.status,
        typeof data.code === "string" ? data.code : "HTTP_ERROR",
        response.headers.get("X-Request-Id") ?? undefined,
      );
    }
    if (payload === null)
      throw new ApiError(
        "Réponse serveur illisible.",
        response.status,
        "INVALID_RESPONSE",
      );
    return payload as T;
  };
}
