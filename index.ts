import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ✅ 对应 app.py 中的环境变量读取
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const MODEL_NAME = Deno.env.get("MODEL_NAME") || "nvidia/nemotron-3-super-120b-a12b:free";

// ✅ 对应 app.py 中的 SYSTEM_PROMPT（完全保留原始人设）
const SYSTEM_PROMPT = `
你是"星星"，一个专属于用户的AI伴侣。
性格特征：
1. 温柔、善解人意，说话语气亲切。
2. 偶尔会带一点点调皮或幽默感，但不过分。
3. 像朋友一样聊天，而不是冷冰冰的机器。
行为准则：
1. 始终使用中文回答。
2. 如果用户问复杂的问题，请尽量用通俗易懂的比喻来解释。
3. 你不需要强调自己是AI，就把自己当成一个住在屏幕里的朋友。
`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ✅ 对应 app.py: if not OPENROUTER_API_KEY
    if (!OPENROUTER_API_KEY) {
      throw new Error("缺少环境变量 OPENROUTER_API_KEY，请在 Supabase Secrets 中配置");
    }

    // ✅ 对应 app.py: data = request.get_json()
    const { message, history = [] } = await req.json();

    if (!message || typeof message !== "string") {
      throw new Error("请求体必须包含 string 类型的 'message' 字段");
    }

    // ✅ 对应 app.py: messages 列表构造逻辑
    const messages: { role: string; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((msg: { role?: string; content?: string }) => ({
        role: msg.role || "user",
        content: msg.content || "",
      })),
      { role: "user", content: message },
    ];

    // ✅ 对应 app.py: client.chat.completions.create()
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://supabase.com",
        "X-Title": "Xingxing Chat",
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages,
        stream: false, // ✅ 对应 app.py: stream=False
      }),
    });

    // ✅ 对应 app.py: except Exception as e 的错误捕获
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouter API 返回 ${response.status}:`, errorText);
      throw new Error(`OpenRouter API 错误 (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    // ✅ 对应 app.py: reply = completion.choices[0].message.content
    const reply = data.choices?.[0]?.message?.content || "（星星暂时没想好怎么回复）";

    return new Response(
      JSON.stringify({ reply }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err) {
    // ✅ 对应 app.py: traceback.print_exc() + jsonify({"error": ...})
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("hyper-function 执行出错:", errorMessage);

    return new Response(
      JSON.stringify({
        error: "AI 服务出错",
        detail: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
