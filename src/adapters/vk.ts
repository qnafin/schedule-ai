const VK_API = "https://api.vk.com/method";

export const createVkClient = ({ token, version = "5.199" }) => {
  if (!token) throw new Error("VK_ACCESS_TOKEN не задан");

  const call = async (method, params) => {
    const body = new URLSearchParams({
      ...params,
      access_token: token,
      v: version,
    });

    const res = await fetch(`${VK_API}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const data = await res.json();
    if (data.error) {
      const err = new Error(`VK ${method}: ${data.error.error_msg}`);
      err.vkError = data.error;
      throw err;
    }
    return data.response;
  };

  const resolveScreenName = async (screenName) => {
    const users = await call("users.get", { user_ids: screenName });
    if (!Array.isArray(users) || !users.length) return null;
    return users[0].id;
  };

  const send = ({ userId, text, randomId }) =>
    call("messages.send", {
      user_id: String(userId),
      message: text,
      random_id: String(randomId ?? Date.now()),
    });

  const sendToChat = ({ peerId, text, randomId }) =>
    call("messages.send", {
      peer_id: String(peerId),
      message: text,
      random_id: String(randomId ?? Date.now()),
    });

  return { resolveScreenName, send, sendToChat };
};
