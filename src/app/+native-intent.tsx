// Google vuelve a la app con mivida://oauthredirect?code=...; expo-auth-session ya lee esa URL,
// así que al router lo mando a Hoy en vez de mostrar "Unmatched Route".
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  if (path.includes('oauthredirect')) return '/';
  return path;
}
