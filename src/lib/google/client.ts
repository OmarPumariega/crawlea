import { prisma } from "@/lib/db/prisma";
import { decrypt } from "@/lib/crypto";
import { createOAuthClient, type GoogleOAuthClient } from "@/lib/google/oauth";

export class GoogleNotConnectedError extends Error {
  constructor() {
    super("No hay ninguna cuenta de Google conectada");
    this.name = "GoogleNotConnectedError";
  }
}

// Sin caché en memoria: a diferencia de getOpenRouterClient(), esto debe
// reflejar siempre el estado actual en BD. Si se desconecta o reconecta,
// la siguiente llamada tiene que verlo al instante, no servir un cliente
// construido con un refresh token que ya no es el vigente.
//
// En el SaaS cada usuario conecta SU cuenta de Google (una fila por usuario
// en GoogleConnection); el userId es obligatorio y explícito para que ningún
// caller herede por accidente la conexión de otro.
export async function getGoogleClient(userId: string): Promise<GoogleOAuthClient> {
  const connection = await prisma.googleConnection.findUnique({
    where: { userId },
  });
  if (!connection) throw new GoogleNotConnectedError();

  const client = await createOAuthClient();
  client.setCredentials({ refresh_token: decrypt(connection.encryptedRefreshToken) });
  return client;
}
