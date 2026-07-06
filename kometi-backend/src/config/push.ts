// src/config/push.ts
// Expo Push Notification helper — sends device-level push notifications.
// Uses Expo Push API: https://docs.expo.dev/push-notifications/sending-notifications/

import supabase from "./supabase";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  badge?: number;
}

interface PushResult {
  status: string;
  id?: string;
  message?: string;
  error?: string;
}

/**
 * Send push notification to a single user (all their registered devices).
 * Looks up deviceTokens from the users table and sends to each.
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("deviceTokens")
      .eq("id", userId)
      .single();

    if (error || !user) {
      console.error("[Push] Failed to fetch user tokens:", error?.message);
      return;
    }

    const tokens = (user as any).deviceTokens;
    if (!Array.isArray(tokens) || tokens.length === 0) {
      return; // No devices registered
    }

    await sendPushToTokens(tokens, title, body, data);
  } catch (err) {
    console.error("[Push] sendPushToUser failed:", err);
  }
}

/**
 * Send push notification to multiple users.
 */
export async function sendPushToUsers(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  if (userIds.length === 0) return;

  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("id, deviceTokens")
      .in("id", userIds);

    if (error || !users) {
      console.error("[Push] Failed to fetch user tokens:", error?.message);
      return;
    }

    const allTokens: string[] = [];
    for (const user of users) {
      const tokens = (user as any).deviceTokens;
      if (Array.isArray(tokens)) {
        allTokens.push(...tokens);
      }
    }

    if (allTokens.length === 0) return;

    await sendPushToTokens(allTokens, title, body, data);
  } catch (err) {
    console.error("[Push] sendPushToUsers failed:", err);
  }
}

/**
 * Send push notifications to a list of Expo push tokens.
 * Batches into chunks of 100 (Expo limit).
 */
async function sendPushToTokens(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  // Deduplicate tokens
  const uniqueTokens = [...new Set(tokens)];

  const messages: PushMessage[] = uniqueTokens.map((token) => ({
    to: token,
    title,
    body,
    data: data || {},
    sound: "default",
  }));

  // Send in batches of 100
  const CHUNK_SIZE = 100;
  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.EXPO_ACCESS_TOKEN
            ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
            : {}),
        },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        console.error(`[Push] Expo API error: ${response.status}`);
        continue;
      }

      const results = (await response.json()) as PushResult[];

      // Handle invalid tokens — remove from DB
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === "error" && result.error === "InvalidCredentials") {
          console.error("[Push] Invalid Expo credentials — check EXPO_ACCESS_TOKEN");
        }
        if (result.status === "error" && result.message?.includes("DeviceNotRegistered")) {
          // Remove invalid token from all users
          const invalidToken = chunk[j]?.to;
          if (invalidToken) {
            await removeInvalidToken(invalidToken);
          }
        }
      }
    } catch (err) {
      console.error("[Push] Batch send failed:", err);
    }
  }
}

/**
 * Remove an invalid/expired push token from all users.
 */
async function removeInvalidToken(token: string): Promise<void> {
  try {
    // Get all users that have this token
    const { data: users } = await supabase
      .from("users")
      .select("id, deviceTokens")
      .contains("deviceTokens", [token]);

    if (!users || users.length === 0) return;

    for (const user of users) {
      const tokens = ((user as any).deviceTokens || []).filter((t: string) => t !== token);
      await supabase
        .from("users")
        .update({ deviceTokens: tokens })
        .eq("id", user.id);
    }

    console.log(`[Push] Removed invalid token from ${users.length} user(s)`);
  } catch (err) {
    console.error("[Push] Failed to remove invalid token:", err);
  }
}

/**
 * Register a device token for a user (adds to deviceTokens array).
 */
export async function registerDeviceToken(
  userId: string,
  token: string
): Promise<{ success: boolean }> {
  try {
    // Get current tokens
    const { data: user } = await supabase
      .from("users")
      .select("deviceTokens")
      .eq("id", userId)
      .single();

    const currentTokens = ((user as any)?.deviceTokens || []) as string[];

    // Add token if not already present
    if (!currentTokens.includes(token)) {
      const updatedTokens = [...currentTokens, token];
      await supabase
        .from("users")
        .update({ deviceTokens: updatedTokens })
        .eq("id", userId);
    }

    return { success: true };
  } catch (err) {
    console.error("[Push] registerDeviceToken failed:", err);
    return { success: false };
  }
}

/**
 * Remove a device token for a user (e.g. on logout).
 */
export async function removeDeviceToken(
  userId: string,
  token: string
): Promise<void> {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("deviceTokens")
      .eq("id", userId)
      .single();

    const currentTokens = ((user as any)?.deviceTokens || []) as string[];
    const updatedTokens = currentTokens.filter((t) => t !== token);

    await supabase
      .from("users")
      .update({ deviceTokens: updatedTokens })
      .eq("id", userId);
  } catch (err) {
    console.error("[Push] removeDeviceToken failed:", err);
  }
}
