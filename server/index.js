import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

const envPath = fileURLToPath(new URL('./.env', import.meta.url))
dotenv.config({ path: envPath })

const app = express()
const port = Number(process.env.PORT || 3001)
const gameStateTableName = 'kingen_game_states'
const kingenPlayersTableName = 'kingen_players'
const gameEventClients = new Map()
const gameHostLocks = new Map()
const HOST_LOCK_TTL_MS = 30_000

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'laurierboom',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

app.use(cors())
app.use(express.json({ limit: '1mb' }))

function normalizeGameId(rawGameId) {
  const safe = String(rawGameId || '').trim().toLowerCase()
  if (!/^[a-z0-9_-]{3,32}$/.test(safe)) {
    return null
  }

  return safe
}

function normalizeHostId(rawHostId) {
  const safe = String(rawHostId || '').trim().toLowerCase()
  if (!/^[a-z0-9_-]{8,64}$/.test(safe)) {
    return null
  }

  return safe
}

function getActiveGameHostLock(gameId) {
  const lock = gameHostLocks.get(gameId)
  if (!lock) {
    return null
  }

  if (Date.now() - lock.updatedAt > HOST_LOCK_TTL_MS) {
    gameHostLocks.delete(gameId)
    return null
  }

  return lock
}

function addGameEventClient(gameId, response) {
  const clients = gameEventClients.get(gameId) || new Set()
  clients.add(response)
  gameEventClients.set(gameId, clients)
}

function removeGameEventClient(gameId, response) {
  const clients = gameEventClients.get(gameId)
  if (!clients) {
    return
  }

  clients.delete(response)
  if (clients.size === 0) {
    gameEventClients.delete(gameId)
  }
}

function emitGameUpdate(gameId, payload) {
  const clients = gameEventClients.get(gameId)
  if (!clients) {
    return
  }

  const serializedPayload = `data: ${JSON.stringify(payload)}\n\n`
  for (const response of clients) {
    response.write(serializedPayload)
  }
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${gameStateTableName} (
      game_id VARCHAR(32) PRIMARY KEY,
      state_json LONGTEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${kingenPlayersTableName} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      naam VARCHAR(64) NOT NULL UNIQUE
    )
  `)

  await pool.query(`
    INSERT IGNORE INTO ${kingenPlayersTableName} (naam)
    VALUES ('Jan'), ('Willem'), ('Gerard'), ('Jeroen')
  `)
}

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/player-names', async (_req, res) => {
  try {
    const [rows] = await pool.query(`SELECT naam AS name FROM ${kingenPlayersTableName} ORDER BY naam, id`)
    res.json({
      names: rows.map((row) => String(row.name || '').trim()).filter(Boolean)
    })
  } catch (error) {
    console.error('Kon spelersnamen niet laden:', error)
    res.status(500).json({ error: 'Serverfout bij laden van spelersnamen.' })
  }
})

app.post('/api/player-names', async (req, res) => {
  const name = String(req.body?.name || '').trim()
  if (!name || name.length < 2 || name.length > 64) {
    res.status(400).json({ error: 'Ongeldige spelernaam.' })
    return
  }

  try {
    const [existing] = await pool.query(`SELECT id FROM ${kingenPlayersTableName} WHERE LOWER(naam) = LOWER(?) LIMIT 1`, [name])
    if (existing.length) {
      res.status(409).json({ error: 'Speler bestaat al.' })
      return
    }

    await pool.query(`INSERT INTO ${kingenPlayersTableName} (naam) VALUES (?)`, [name])
    res.status(201).json({ ok: true, name })
  } catch (error) {
    console.error('Kon spelernaam niet opslaan:', error)
    res.status(500).json({ error: 'Serverfout bij opslaan van spelernaam.' })
  }
})

app.get('/api/games', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT game_id, updated_at FROM ${gameStateTableName} ORDER BY updated_at DESC LIMIT 100`
    )

    res.json({
      games: rows.map((row) => ({
        gameId: String(row.game_id || ''),
        updatedAt: Number(row.updated_at || 0),
        hostLocked: Boolean(getActiveGameHostLock(String(row.game_id || '')))
      }))
    })
  } catch (error) {
    console.error('Kon gameslijst niet laden:', error)
    res.status(500).json({ error: 'Serverfout bij laden van gameslijst.' })
  }
})

app.get('/api/games/:gameId/host-lock', (req, res) => {
  const gameId = normalizeGameId(req.params.gameId)
  if (!gameId) {
    res.status(400).json({ error: 'Ongeldige game id.' })
    return
  }

  const currentLock = getActiveGameHostLock(gameId)
  res.json({
    gameId,
    hostLocked: Boolean(currentLock),
    activeHostSince: currentLock?.updatedAt || null
  })
})

app.get('/api/games/:gameId/events', (req, res) => {
  const gameId = normalizeGameId(req.params.gameId)
  if (!gameId) {
    res.status(400).json({ error: 'Ongeldige game id.' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  addGameEventClient(gameId, res)
  res.write(`data: ${JSON.stringify({ connected: true, at: Date.now() })}\n\n`)

  req.on('close', () => {
    removeGameEventClient(gameId, res)
  })
})

app.post('/api/games/:gameId/host-lock', (req, res) => {
  const gameId = normalizeGameId(req.params.gameId)
  if (!gameId) {
    res.status(400).json({ error: 'Ongeldige game id.' })
    return
  }

  const hostId = normalizeHostId(req.body?.hostId)
  if (!hostId) {
    res.status(400).json({ error: 'Ongeldige host id.' })
    return
  }

  const now = Date.now()
  const currentLock = getActiveGameHostLock(gameId)
  if (currentLock && currentLock.hostId !== hostId) {
    res.status(409).json({
      error: 'Deze gamecode heeft al een actieve host.',
      activeHostSince: currentLock.updatedAt
    })
    return
  }

  gameHostLocks.set(gameId, { hostId, updatedAt: now })
  res.json({ ok: true, hostId, updatedAt: now })
})

app.delete('/api/games/:gameId/host-lock', (req, res) => {
  const gameId = normalizeGameId(req.params.gameId)
  if (!gameId) {
    res.status(400).json({ error: 'Ongeldige game id.' })
    return
  }

  const hostId = normalizeHostId(req.body?.hostId)
  if (!hostId) {
    res.status(400).json({ error: 'Ongeldige host id.' })
    return
  }

  const currentLock = getActiveGameHostLock(gameId)
  if (!currentLock || currentLock.hostId !== hostId) {
    res.json({ ok: true })
    return
  }

  gameHostLocks.delete(gameId)
  res.json({ ok: true })
})

app.get('/api/games/:gameId/state', async (req, res) => {
  const gameId = normalizeGameId(req.params.gameId)
  if (!gameId) {
    res.status(400).json({ error: 'Ongeldige game id.' })
    return
  }

  try {
    const [rows] = await pool.query(`SELECT state_json, updated_at FROM ${gameStateTableName} WHERE game_id = ?`, [gameId])
    if (!rows.length) {
      res.status(404).json({ error: 'Nog geen state voor deze game.' })
      return
    }

    const row = rows[0]
    res.json({
      state: JSON.parse(row.state_json),
      updatedAt: Number(row.updated_at)
    })
  } catch (error) {
    console.error('Kon game state niet laden:', error)
    res.status(500).json({ error: 'Serverfout bij laden van state.' })
  }
})

app.put('/api/games/:gameId/state', async (req, res) => {
  const gameId = normalizeGameId(req.params.gameId)
  if (!gameId) {
    res.status(400).json({ error: 'Ongeldige game id.' })
    return
  }

  const state = req.body?.state
  if (!state || typeof state !== 'object') {
    res.status(400).json({ error: 'State ontbreekt of is ongeldig.' })
    return
  }

  const updatedAt = Date.now()

  try {
    await pool.query(
      `
      INSERT INTO ${gameStateTableName} (game_id, state_json, updated_at)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        state_json = VALUES(state_json),
        updated_at = VALUES(updated_at)
      `,
      [gameId, JSON.stringify(state), updatedAt]
    )

    emitGameUpdate(gameId, { updatedAt })

    res.json({ ok: true, updatedAt })
  } catch (error) {
    console.error('Kon game state niet opslaan:', error)
    res.status(500).json({ error: 'Serverfout bij opslaan van state.' })
  }
})

async function start() {
  try {
    await ensureSchema()
    app.listen(port, () => {
      console.log(`Kingscore API draait op poort ${port}`)
    })
  } catch (error) {
    console.error('Kon API niet starten:', error)
    process.exit(1)
  }
}

start()
