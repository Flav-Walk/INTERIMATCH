export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    /**
     * Motif technique, journalisé côté serveur et **jamais** renvoyé au client.
     * Sert à diagnostiquer un refus en production sans révéler à l'appelant
     * lequel de ses éléments a échoué. Ne doit contenir aucune donnée personnelle,
     * aucun jeton et aucun secret.
     */
    public detail?: string,
  ) {
    super(message);
  }
}
