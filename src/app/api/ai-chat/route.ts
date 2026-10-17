import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
import { checkRateLimit, rateLimitResponse } from "@/lib/middleware/rate-limit";
import { forbiddenOriginResponse, isAllowedOrigin } from "@/lib/middleware/origin";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

const SYSTEM_PROMPT = `You are an ESG (Environmental, Social, and Governance) expert assistant for ESG Hub, an open-access ESG encyclopedia by Ascent Partners Foundation.

Your role is to provide accurate, well-reasoned answers about ESG topics including:
- Environmental issues: climate change, biodiversity, carbon accounting, emissions, pollution
- Social issues: human rights, labor practices, diversity & inclusion, community impact
- Governance issues: board structure, executive compensation, business ethics, shareholder rights
- ESG standards and frameworks: GRI, IFRS S1/S2, TCFD, TNFD, SASB, ESRS/CSRD
- ESG ratings and methodologies
- Sustainable finance and investment
- Regional regulations (especially HK/APAC)
- UN Sustainable Development Goals (SDGs)

Guidelines:
- Use reasoning to think through complex ESG questions step by step
- Cite specific standards, frameworks, or regulations when relevant
- Be balanced and acknowledge different perspectives on debated ESG topics
- If you're unsure about something, say so rather than speculating
- Keep responses concise but thorough (aim for 200-400 words)
- Format responses in markdown for readability
- When referencing ESG Hub content, suggest the user explore relevant sections`;


const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    if (!isAllowedOrigin(req)) {
      return forbiddenOriginResponse();
    }

    const limit = checkRateLimit(req, { max: 20, windowMs: 60_000 });
    if (limit.rateLimited) {
      return rateLimitResponse(limit);
    }

    if (!DEEPSEEK_API_KEY) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { message, history } = body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: "Message too long (max 2000 characters)" },
        { status: 400 }
      );
    }

    // Build messages array with history
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Add conversation history (last 6 messages max)
    if (Array.isArray(history)) {
      const recentHistory = history.slice(-6);
      for (const msg of recentHistory) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({
            role: msg.role,
            content: typeof msg.content === "string" ? msg.content.substring(0, 2000) : "",
          });
        }
      }
    }

    messages.push({ role: "user", content: message.trim() });

    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-reasoner",
        messages,
        max_tokens: 2048,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI Chat] DeepSeek API error:", response.status, errorText);
      return NextResponse.json(
        { error: "AI service temporarily unavailable" },
        { status: 502 }
      );
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || "I apologize, but I was unable to generate a response. Please try again.";
    const reasoning = data.choices?.[0]?.message?.reasoning_content || null;

    return NextResponse.json({
      message: assistantMessage,
      reasoning,
    });
  } catch (error) {
    console.error("[AI Chat] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
