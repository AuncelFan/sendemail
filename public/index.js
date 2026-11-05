const form = document.getElementById("emailForm");
const message = document.getElementById("message");
const result = document.getElementById("result");
const button = document.getElementById("sendButton");
const buttonLabel = document.getElementById("buttonLabel");

message.placeholder = "你好，\n\n从这里开始，写下你想分享的事…";
message.addEventListener("input", () => {
  document.getElementById("characterCount").value = String(
    message.value.length,
  );
});

function showStatus(state, text) {
  result.hidden = false;
  result.dataset.state = state;
  result.textContent = text;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (button.disabled) return;
  const data = Object.fromEntries(new FormData(form));
  const payload = {
    from: data.from.trim(),
    to: data.to.trim(),
    subject: data.subject.trim(),
    text: data.message,
    password: data.password,
  };
  if (!payload.subject || !payload.text.trim()) {
    showStatus("error", "请填写邮件主题和正文。");
    return;
  }
  button.disabled = true;
  buttonLabel.textContent = "正在发送…";
  form.setAttribute("aria-busy", "true");
  showStatus("pending", "正在提交邮件，请稍候…");
  try {
    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || "发送失败，请稍后重试。");
    showStatus("success", "邮件已提交发送！内容已保留，方便你继续查看。");
  } catch (error) {
    showStatus(
      "error",
      error.name === "TimeoutError"
        ? "等待响应超时，请先查看 Resend 发送记录，确认状态后再重试。"
        : error instanceof TypeError
          ? "网络连接异常，请检查网络及发送记录后再重试。"
          : error.message,
    );
  } finally {
    button.disabled = false;
    buttonLabel.textContent = "发送邮件";
    form.removeAttribute("aria-busy");
  }
});
