import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/parties/[id] - 获取饭局详情
 * 支持通过 id 或 shareCode 查询
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const isId = !isNaN(Number(id));

        // 如果通过 shareCode 查询，需要先找到 ID
        let partyId: number;
        if (isId) {
            partyId = Number(id);
        } else {
            const p = await prisma.party.findUnique({ where: { shareCode: id as string } });
            if (!p) return NextResponse.json({ success: false, error: "饭局不存在" }, { status: 404 });
            partyId = p.id;
        }

        // 获取当前用户（可能是 Host 或 Guest）以决定返回什么数据
        // 但鉴于需求，Host 和 Guest 看到的信息基本一致（Guest 也能看到谁选了什么）
        // 所以统一返回完整信息，前端负责展示差异

        const party = await prisma.party.findUnique({
            where: { id: partyId },
            include: {
                host: { select: { id: true, username: true } },
                poolDishes: {
                    include: {
                        selections: {
                            include: {
                                guest: { select: { id: true, nickname: true } },
                            },
                        },
                    },
                    orderBy: { createdAt: "asc" },
                },
                guests: {
                    select: { id: true, nickname: true, guestToken: true }, // 注意：guestToken 应该脱敏吗？
                    // Guest 需要知道自己的 token，但不能知道别人的。
                    // 这里简单处理：API 不脱敏，但在前端只存储自己的。
                    // 安全起见，应该只有 Auth 的 Host 能看到所有 token? 
                    // 或者 Guest join 时返回 token，这里不返回。
                    // 修正：这里不返回 guestToken，只返回基本信息。
                },
            },
        });

        if (!party) {
            return NextResponse.json(
                { success: false, error: "饭局不存在" },
                { status: 404 }
            );
        }

        // 计算统计数据
        // 1. 菜品池总成本 (Host 采购预算参考，如果全买的话)
        // 2. 实际被选菜品总成本 (Purchase List)

        // 这里只看"被选中的菜品"的成本累加吗？
        // 需求：发起人可以导出菜品清单详情以方便购买食材
        // 这意味着"采购清单"是基于"被选中的菜品"生成的。

        // 我们返回给前端用于展示的数据：
        const data = {
            ...party,
            guests: party.guests.map(g => ({ id: g.id, nickname: g.nickname })), // 脱敏 guestToken
        };

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("获取饭局详情失败:", error);
        return NextResponse.json(
            { success: false, error: "获取饭局详情失败" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/parties/[id] - 删除饭局（仅 Host）
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    try {
        const userId = getUserIdFromRequest(req);
        if (!userId) {
            return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
        }
        const { id } = await params;
        const partyId = Number(id);

        const party = await prisma.party.findFirst({
            where: { id: partyId, hostId: userId },
        });
        if (!party) {
            return NextResponse.json(
                { success: false, error: "饭局不存在或无权操作" },
                { status: 404 }
            );
        }

        await prisma.party.delete({ where: { id: partyId } });

        return NextResponse.json({ success: true, data: { id: partyId } });
    } catch (error) {
        console.error("删除饭局失败:", error);
        return NextResponse.json(
            { success: false, error: "删除饭局失败" },
            { status: 500 }
        );
    }
}
