// PROTOTYPE — throwaway. Answers "Prototype how notifications look and behave
// in the app" (wayfinder ticket #7). Not production code: no tests, no error
// handling, no fake notifier. Lives on the prototype/notifications-ui branch only.
import { Knock, signUserToken } from "@knocklabs/node";
import { MOCK_MESSAGES, type MockMessageType } from "~/components/notifications-prototype/mock-messages";

const knock = new Knock({ apiKey: process.env.KNOCK_SECRET_API_KEY });

/** Knock recipient id for a Cadence user. */
export function knockUserId(userId: number) {
  return String(userId);
}

/** Signed, expiring token so the browser may read this user's feed. */
export function signKnockUserToken(userId: number) {
  return signUserToken(knockUserId(userId), {
    signingKey: process.env.KNOCK_SIGNING_KEY,
    expiresInSeconds: 60 * 60,
  });
}

export function knockClientConfig() {
  return {
    publicApiKey: process.env.KNOCK_PUBLIC_API_KEY!,
    feedChannelId: process.env.KNOCK_FEED_CHANNEL_ID!,
  };
}

/** Triggers the throwaway `in-app-test` workflow with one of the five mock messages. */
export async function triggerTestNotification(
  recipient: { id: number; name: string },
  type: MockMessageType
) {
  const message = MOCK_MESSAGES[type];
  return knock.workflows.trigger("in-app-test", {
    recipients: [{ id: knockUserId(recipient.id), name: recipient.name }],
    data: { ...message, type },
  });
}
