import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";
import crypto from "crypto";

/**
 * POST /api/share/create - 创建 6 位分享码
 * body: { type: "DISH" | "MENU" | "PARTY", refId: number }
 */
export async function POST(req: NextRequest) {
    try {
        const userId = getUserIdFromRequest(req);
        if (!userId) {
            return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
        }

        const body = await req.json();
        const { type, refId } = body;

        if (!["DISH", "MENU", "PARTY"].includes(type) || !refId) {
            return NextResponse.json(
                { success: false, error: "参数无效" },
                { status: 400 }
            );
        }

        // 验证资源是否存在且属于用户
        let exists = false;
        if (type === "DISH") {
            exists = !!(await prisma.dish.findFirst({ where: { id: refId, userId } }));
        } else if (type === "MENU") {
            exists = !!(await prisma.menu.findFirst({ where: { id: refId, userId } }));
        } else if (type === "PARTY") {
            // 饭局分享码与 shareCode 字段一致，不需要创建 ShareToken 记录，直接返回 shareCode
            const party = await prisma.party.findFirst({ where: { id: refId, hostId: userId } });
            if (party) {
                return NextResponse.json({ success: true, data: { code: party.shareCode, type: "PARTY" } });
            }
        }

        if (!exists && type !== "PARTY") {
            return NextResponse.json(
                { success: false, error: "资源不存在或无权分享" },
                { status: 404 }
            );
        }

        // 检查是否已存在关联的分享码
        const existing = await prisma.shareToken.findFirst({
            where: { type, refId, userId },
        });
        if (existing) {
            return NextResponse.json({ success: true, data: existing });
        }

        // 生成不重复的 6 位码
        let code = "";
        let attempts = 0;
        while (attempts < 10) {
            code = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 chars
            const conflict = await prisma.shareToken.findUnique({ where: { code } });
            const partyConflict = await prisma.party.findUnique({ where: { shareCode: code } });
            if (!conflict && !partyConflict) break;
            attempts++;
        }

        if (attempts >= 10) {
            return NextResponse.json(
                { success: false, error: "生成分享码失败，请重试" },
                { status: 500 }
            );
        }

        const token = await prisma.shareToken.create({
            data: { code, type, refId, userId },
        });

        return NextResponse.json({ success: true, data: token });

    } catch (error) {
        console.error("创建分享码失败:", error);
        return NextResponse.json(
            { success: false, error: "创建分享码失败" },
            { status: 500 }
        );
    }
}
