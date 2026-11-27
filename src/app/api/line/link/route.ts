import { v7 as uuidv7 } from "uuid";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionContext } from "@/lib/permissions";
import { generateLinkCode, getLineOaBasicId } from "@/lib/line";
import { isLineLoginConfigured } from "@/lib/lineOAuth";
import { safeErrorMessage } from "@/lib/apiError";

const LINK_TOKEN_TTL_MS = 10 * 60 * 1000;

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx?.id) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 }
      );
    }

    const account = await prisma.lineAccount
      .findUnique({
        where: { user_id: ctx.id },
        select: {
          line_user_id: true,
          display_name: true,
          linked_at: true,
        },
      })
      .catch(() => null);

    const activeToken = await prisma.lineLinkToken
      .findFirst({
        where: {
          user_id: ctx.id,
          used_at: null,
          expires_at: { gt: new Date() },
        },
        orderBy: { created_at: "desc" },
        select: { token: true, expires_at: true },
      })
      .catch(() => null);

    return NextResponse.json({
      status: "success",
      data: {
        linked: Boolean(account?.line_user_id),
        lineDisplayName: account?.display_name || null,
        linkedAt: account?.linked_at?.toISOString() || null,
        oaBasicId: getLineOaBasicId(),
        lineLoginEnabled: isLineLoginConfigured(),
        activeToken: activeToken
          ? {
              token: activeToken.token,
              expiresAt: activeToken.expires_at.toISOString(),
            }
          : null,
      },
    });
  } catch (error: unknown) {
    console.error("GET /api/line/link error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: safeErrorMessage(error, "Failed to check LINE status"),
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const ctx = await getSessionContext();
    if (!ctx?.id) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 }
      );
    }

    const code = generateLinkCode();
    const expiresAt = new Date(Date.now() + LINK_TOKEN_TTL_MS);

    await prisma.$transaction([
      prisma.lineLinkToken.updateMany({
        where: { user_id: ctx.id, used_at: null },
        data: { used_at: new Date() },
      }),
      prisma.lineLinkToken.create({
        data: {
          id: uuidv7(),
          token: code,
          user_id: ctx.id,
          expires_at: expiresAt,
        },
      }),
    ]);

    return NextResponse.json({
      status: "success",
      data: {
        token: code,
        expiresAt: expiresAt.toISOString(),
        oaBasicId: getLineOaBasicId(),
      },
    });
  } catch (error: unknown) {
    console.error("POST /api/line/link error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: safeErrorMessage(error, "Failed to generate LINE link code"),
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const ctx = await getSessionContext();
    if (!ctx?.id) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 }
      );
    }

    await prisma.$transaction([
      prisma.lineAccount.deleteMany({
        where: { user_id: ctx.id },
      }),
      prisma.lineLinkToken.updateMany({
        where: { user_id: ctx.id, used_at: null },
        data: { used_at: new Date() },
      }),
    ]);

    return NextResponse.json({ status: "success" });
  } catch (error: unknown) {
    console.error("DELETE /api/line/link error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: safeErrorMessage(error, "Failed to unlink LINE account"),
      },
      { status: 500 }
    );
  }
}
