const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ message: "请求格式错误，请使用 JSON。" }, 400);
  }
  if (typeof env.SECRET !== "string" || !env.SECRET.trim()) {
    return json(
      { message: "发送密码尚未配置，请联系管理员设置 SECRET。" },
      503,
    );
  }
  if (typeof payload?.password !== "string" || !payload.password) {
    return json({ message: "请输入正确的发送密码。" }, 401);
  }
  // Compare fixed-length hashes without stopping at the first mismatched byte.
  const encoder = new TextEncoder();
  const [provided, expected] = await Promise.all(
    [payload.password, env.SECRET].map(
      async (value) =>
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", encoder.encode(value)),
        ),
    ),
  );
  let difference = 0;
  for (let i = 0; i < expected.length; i++) {
    difference |= provided[i] ^ expected[i];
  }
  if (difference !== 0) {
    return json({ message: "请输入正确的发送密码。" }, 401);
  }
  if (
    !payload ||
    ["from", "to", "subject", "text"].some(
      (key) => typeof payload[key] !== "string" || !payload[key].trim(),
    )
  ) {
    return json({ message: "请完整填写发件人、收件人、主题和正文。" }, 400);
  }
  const { text } = payload;
  const from = payload.from.trim();
  const to = payload.to.trim();
  const subject = payload.subject.trim();
  const email = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
  if (
    !email.test(from) ||
    !email.test(to) ||
    from.length > 254 ||
    to.length > 254
  ) {
    return json({ message: "请输入有效的发件人和收件人邮箱地址。" }, 400);
  }
  if (subject.length > 200 || text.length > 50000) {
    return json({ message: "主题最多 200 字符，正文最多 50,000 字符。" }, 400);
  }
  if (!env.RESEND_API_KEY) {
    return json(
      { message: "邮件服务尚未配置，请联系管理员设置 RESEND_API_KEY。" },
      503,
    );
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
      signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (!response.ok) {
      return json(
        {
          message:
            typeof result.message === "string"
              ? result.message
              : "邮件服务暂时无法发送，请稍后重试。",
        },
        response.status === 429 ? 429 : 502,
      );
    }
    return json({ message: "邮件已提交发送。" });
  } catch {
    return json(
      {
        message: "邮件服务连接异常，请检查 Resend 发送记录，确认状态后再重试。",
      },
      502,
    );
  }
}
