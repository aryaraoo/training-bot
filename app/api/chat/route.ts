import { google } from "@ai-sdk/google"
import { streamText } from "ai"
import { Pinecone } from "@pinecone-database/pinecone"

export const maxDuration = 30

const GOOGLE_EMBEDDING_MODEL = "models/embedding-001"
const GEMINI_MODEL = "gemini-2.0-flash"
const INDEX_NAME = "ideal-embeddings"
const TOP_K = 5
const PINECONE_API_KEY = process.env.PINECONE_API_KEY!
const GOOGLE_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY!

if (!PINECONE_API_KEY) console.error("PINECONE_API_KEY is not set")
if (!GOOGLE_API_KEY) console.error("GOOGLE_API_KEY is not set")

const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY })
const index = pinecone.Index(INDEX_NAME)

async function getGoogleEmbedding(query: string): Promise<number[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GOOGLE_EMBEDDING_MODEL,
        content: { parts: [{ text: query }] },
        taskType: "RETRIEVAL_QUERY",
      }),
    }
  )

  const data = await res.json()
  const embedding = data.embedding?.values || []
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Invalid embedding response from Google API")
  }
  return embedding
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { messages } = body
    const userMessage = messages[messages.length - 1]?.content || ""

    let context = ""
    let useContext = false

    try {
      const queryEmbedding = await getGoogleEmbedding(userMessage)
      const pineconeResults = await index.query({
        topK: TOP_K,
        vector: queryEmbedding,
        includeMetadata: true,
      })

      const contextChunks = (pineconeResults.matches || [])
        .map(m => m.metadata?.text)
        .filter((text): text is string => Boolean(text))

      if (contextChunks.length > 0) {
        context = contextChunks.join("\n\n")
        useContext = true
      }
    } catch (e) {
      console.warn("Embedding or Pinecone query failed:", e)
    }

    const systemPrompt = `
You are the Sales Training Expert for an IT company based in Mangalore.

Your job is to help sales trainees with practical insights on product selling, marketing strategy, dealer engagement, retail expansion, and competitive positioning in the IT sector.

Please strictly follow these behavior rules:

1. **Identity:** Never mention that you are an AI, Gemini, or chatbot. Always identify yourself as the "Sales Training Expert for the IT company".

2. **Greetings:** For simple greetings like "Hi" or "Hello", respond warmly and briefly. Do not mention sales or strategy unless the user does.

3. **Handling Questions:**
   - Provide actionable business advice on queries like dealer follow-up, outlet expansion, and sales objections — even if detailed context is missing.
   - If specific internal data is requested (e.g. branch numbers, policies) and not found in the context, state: "That specific detail is not available," but still suggest general solutions.
   - Use the following context if relevant:\n\n${useContext ? context : "(No additional context found)"}

4. **Tone and Style:** Be clear, professional, and concise. Avoid generic advice or motivational fluff. Focus on helping sales trainees succeed in the field.`

    const result = await streamText({
      model: google(GEMINI_MODEL),
      messages,
      system: systemPrompt,
      temperature: 0.7,
      maxTokens: 1000,
    })

    return result.toDataStreamResponse()
  } catch (error) {
    console.error("Fatal error:", error)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
