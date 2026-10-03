import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { BatchWriteCommand, DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
import type { Rollup } from './types.ts'

// Table bamware-<env>-ai-usage (bamware-infra, environments/dev/main.tf).
//   PK = DAY#<UTC date>   SK = <HH>#<host>#<source>#<sessionId>#<stream>#<model>
// Reading a day is one Query; a week is seven. Items expire after ~400 days.

const TTL_SECONDS = 400 * 24 * 3600

// Per-server capability object, read from the existing host file in place.
// Do not copy credentials into process.env or a new configuration file.
export function createUsageStore(env: Record<string, string | undefined> = process.env) {

// Vercel reserves the plain AWS_* names, so the credentials are prefixed.
function client(): DynamoDBDocumentClient {
  const accessKeyId = env.AI_USAGE_AWS_ACCESS_KEY_ID
  const secretAccessKey = env.AI_USAGE_AWS_SECRET_ACCESS_KEY
  const base = new DynamoDBClient({
    region: env.AI_USAGE_AWS_REGION || 'us-east-1',
    // Local development only: point at DynamoDB Local.
    ...(env.AI_USAGE_DYNAMODB_ENDPOINT ? { endpoint: env.AI_USAGE_DYNAMODB_ENDPOINT } : {}),
    ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
  })
  return DynamoDBDocumentClient.from(base, { marshallOptions: { removeUndefinedValues: true } })
}

let cached: DynamoDBDocumentClient | null = null
const db = () => (cached ??= client())

function table(): string {
  const name = env.AI_USAGE_TABLE
  if (!name) throw new Error('AI_USAGE_TABLE is not set')
  return name
}

function isConfigured(): boolean {
  return Boolean(env.AI_USAGE_TABLE)
}

function keyOf(r: Rollup): { PK: string; SK: string } {
  return {
    PK: `DAY#${r.hourStart.slice(0, 10)}`,
    SK: [r.hourStart.slice(11, 13), r.host, r.source, r.sessionId, r.stream, r.model].join('#'),
  }
}

async function putRollups(rollups: Rollup[]): Promise<number> {
  // BatchWrite rejects two puts to the same key in one request; last one wins.
  const byKey = new Map<string, Rollup>()
  for (const r of rollups) {
    const k = keyOf(r)
    byKey.set(`${k.PK}|${k.SK}`, r)
  }
  const expiresAt = Math.floor(Date.now() / 1000) + TTL_SECONDS
  const items = [...byKey.values()].map((r) => ({ ...keyOf(r), ...r, expiresAt }))

  for (let i = 0; i < items.length; i += 25) {
    let requests: NonNullable<ConstructorParameters<typeof BatchWriteCommand>[0]['RequestItems']>[string] =
      items.slice(i, i + 25).map((Item) => ({ PutRequest: { Item } }))
    for (let attempt = 0; requests.length > 0; attempt++) {
      if (attempt === 5) throw new Error(`DynamoDB left ${requests.length} writes unprocessed`)
      if (attempt > 0) await new Promise((r) => setTimeout(r, 100 * 2 ** attempt))
      const out = await db().send(new BatchWriteCommand({ RequestItems: { [table()]: requests } }))
      requests = out.UnprocessedItems?.[table()] ?? []
    }
  }
  return items.length
}

async function queryDay(day: string): Promise<Rollup[]> {
  const rows: Rollup[] = []
  let ExclusiveStartKey: Record<string, unknown> | undefined
  do {
    const out = await db().send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': `DAY#${day}` },
        ExclusiveStartKey,
      }),
    )
    for (const item of out.Items ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { PK, SK, expiresAt, ...r } = item
      rows.push(r as Rollup)
    }
    ExclusiveStartKey = out.LastEvaluatedKey
  } while (ExclusiveStartKey)
  return rows
}

/** Every rollup whose UTC day overlaps [from, to]. */
async function getRollups(from: Date, to: Date): Promise<Rollup[]> {
  const days: string[] = []
  for (let t = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()); t <= to.getTime(); t += 86_400_000) {
    days.push(new Date(t).toISOString().slice(0, 10))
  }
  const perDay = await Promise.all(days.map(queryDay))
  return perDay.flat()
}
return { isConfigured, keyOf, putRollups, getRollups }
}