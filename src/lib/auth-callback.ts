export function readAuthCallback(href: string) {
  const url = new URL(href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const type = fragment.get("type");
  const setup =
    url.searchParams.get("setup") === "1" ||
    url.searchParams.get("auth") === "recovery" ||
    type === "recovery" ||
    type === "invite";
  const hasError =
    fragment.has("error") ||
    fragment.has("error_code") ||
    url.searchParams.has("error") ||
    url.searchParams.has("error_code");
  const hasAuthResponse =
    fragment.has("access_token") || url.searchParams.has("code");
  return {
    setup,
    hasAuthResponse,
    error: hasError
      ? "El enlace de acceso venció, ya fue utilizado o no es válido. Solicita un correo nuevo y abre únicamente el enlace más reciente."
      : "",
  };
}
