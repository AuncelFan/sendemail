import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/send-email.js";
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const valid = {
  from: "hello@example.com",
  to: "reader@example.com",
  subject: "Hello",
  text: "Test message",
  password: "test-password",
};
const context = (
  body = valid,
  env = { RESEND_API_KEY: "test-key", SECRET: "test-password" },
) => ({
  request: new Request("http://localhost/api/send-email", {
    method: "POST",
    body: JSON.stringify(body),
  }),
  env,
});
test("rejects malformed JSON and incomplete or invalid fields before calling Resend", async () => {
  globalThis.fetch = () => {
    throw new Error("Unexpected upstream request");
  };
  const malformed = context();
  malformed.request = new Request("http://localhost", {
    method: "POST",
    body: "{",
  });
  assert.equal((await onRequestPost(malformed)).status, 400);
  for (const body of [
    { password: valid.password },
    { ...valid, text: " " },
    { ...valid, to: "invalid" },
    { ...valid, subject: "a".repeat(201) },
    { ...valid, text: "a".repeat(50001) },
  ]) {
    assert.equal((await onRequestPost(context(body))).status, 400);
  }
});
test("reports missing service configuration", async () => {
  assert.equal(
    (await onRequestPost(context(valid, { SECRET: valid.password }))).status,
    503,
  );
});
test("requires a configured SECRET and rejects invalid passwords without calling Resend", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ id: "unexpected" });
  };
  for (const secret of [undefined, "", "   "]) {
    assert.equal(
      (
        await onRequestPost(
          context(valid, { RESEND_API_KEY: "test-key", SECRET: secret }),
        )
      ).status,
      503,
    );
  }
  for (const body of [
    null,
    {},
    ...[undefined, null, 123, "", "wrong", "test-password "].map(
      (password) => ({ ...valid, password }),
    ),
  ]) {
    const response = await onRequestPost(context(body));
    assert.equal(response.status, 401);
    const result = await response.text();
    assert.equal(result.includes(valid.password), false);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
  assert.equal(calls, 0);
});
test("sends expected provider payload and keeps credentials on the server", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.resend.com/emails");
    assert.equal(options.headers.Authorization, "Bearer test-key");
    const { password, ...email } = valid;
    assert.deepEqual(JSON.parse(options.body), { ...email, to: [valid.to] });
    return Response.json({ id: "test-message" });
  };
  const response = await onRequestPost(context());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const body = await response.text();
  assert.equal(body.includes("test-key"), false);
  assert.equal(body.includes(valid.password), false);
});
test("surfaces provider rejection and rate limiting", async () => {
  for (const [upstream, expected] of [
    [403, 502],
    [429, 429],
  ]) {
    globalThis.fetch = async () =>
      Response.json({ message: "Provider rejection" }, { status: upstream });
    const response = await onRequestPost(context());
    assert.equal(response.status, expected);
    assert.equal((await response.json()).message, "Provider rejection");
  }
});
test("returns useful JSON on network errors or non-JSON upstream responses", async () => {
  for (const mock of [
    async () => {
      throw new Error("secret internal detail");
    },
    async () => new Response("<html>unavailable</html>", { status: 502 }),
  ]) {
    globalThis.fetch = mock;
    const response = await onRequestPost(context());
    assert.equal(response.status, 502);
    assert.match((await response.json()).message, /发送记录/);
  }
});
