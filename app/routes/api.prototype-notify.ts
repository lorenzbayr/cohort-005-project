// PROTOTYPE — throwaway. Server-side trigger of Knock's `in-app-test` workflow.
import { data } from "react-router";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/api.prototype-notify";
import { db } from "~/db";
import { users } from "~/db/schema";
import { getCurrentUserId } from "~/lib/session";
import { triggerTestNotification } from "~/lib/notifications-prototype.server";
import {
  MOCK_MESSAGE_TYPES,
  type MockMessageType,
} from "~/components/notifications-prototype/mock-messages";

export async function action({ request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Select a user from the DevUI panel", { status: 401 });
  }
  const form = await request.formData();
  const type = String(form.get("type")) as MockMessageType;
  const recipientId = Number(form.get("recipientId") || currentUserId);
  if (!MOCK_MESSAGE_TYPES.includes(type)) throw data("Bad type", { status: 400 });

  const recipient = db.select().from(users).where(eq(users.id, recipientId)).get();
  if (!recipient) throw data("No such user", { status: 404 });

  const result = await triggerTestNotification(recipient, type);
  return { ok: true, workflowRunId: result.workflow_run_id, recipient: recipient.name, type };
}
