import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";
import crypto from "crypto";

/**
 * GET /api/parties - 获取当前用户创建的所有饭局
 */
export async function GET(req: NextRequest) {
    try {
        const userId = getUserIdFromRequest(req);
        if (!userId) {
            return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
        }

        const parties = await prisma.party.findMany({
            where: { hostId: userId },
            include: {
                poolDishes: true,
                guests: { select: { id: true, nickname: true } },
                _count: { select: { poolDishes: true, guests: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ success: true, data: parties });
    } catch (error) {
        console.error("获取饭局列表失败:", error);
        return NextResponse.json(
            { success: false, error: "获取饭局列表失败" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/parties - 创建饭局
 * body: { name }
 */
export async function POST(req: NextRequest) {
    try {
        const userId = getUserIdFromRequest(req);
        if (!userId) {
            return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
        }

        const body = await req.json();
        const { name } = body;

        if (!name) {
            return NextResponse.json(
                { success: false, error: "饭局名称不能为空" },
                { status: 400 }
            );
        }

        // 生成不重复的 6 位分享码
        let shareCode = "";
        let attempts = 0;
        while (attempts < 10) {
            shareCode = crypto.randomBytes(3).toString("hex").toUpperCase();
            const conflict = await prisma.party.findUnique({ where: { shareCode } });
            if (!conflict) break;
            attempts++;
        }

        const party = await prisma.party.create({
            data: {
                name,
                shareCode,
                hostId: userId,
            },
        });

        return NextResponse.json({ success: true, data: party }, { status: 201 });
    } catch (error) {
        console.error("创建饭局失败:", error);
        return NextResponse.json(
            { success: false, error: "创建饭局失败" },
            { status: 500 }
        );
    }
}
