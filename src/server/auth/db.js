/**
 * Pool de connexions MariaDB.
 * Une seule instance pour toute l'application : ouvrir une connexion par
 * requête épuiserait le quota de l'hébergement mutualisé en quelques minutes.
 */
export async function createPool(url) {
  const specifier = 'mysql2/promise';
  const mysql = await import(/* @vite-ignore */ specifier);

  const pool = mysql.createPool({
    uri: url,
    connectionLimit: 8,
    waitForConnections: true,
    queueLimit: 0,
    charset: 'utf8mb4',
    timezone: 'Z',
    enableKeepAlive: true,
    keepAliveInitialDelay: 30_000,
  });

  // On vérifie tout de suite : mieux vaut un démarrage qui échoue clairement
  // qu'une application en ligne qui plante à la première inscription.
  const conn = await pool.getConnection();
  try {
    await conn.query('SELECT 1');
  } finally {
    conn.release();
  }
  return pool;
}
