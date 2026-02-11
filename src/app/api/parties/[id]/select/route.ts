import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/parties/[id]/select - Guest 选菜/取消选菜
 * body: { guestToken: string, poolDishId: number, action: 'select' | 'unselect' }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const partyId = Number(id);
        const body = await req.json();
        const { guestToken, poolDishId, action } = body;

        const guest = await prisma.partyGuest.findUnique({
            where: { guestToken },
        });

        if (!guest || guest.partyId !== partyId) {
            return NextResponse.json(
                { success: false, error: "无效的访客身份" },
                { status: 403 }
            );
        }

        const party = await prisma.party.findUnique({ where: { id: partyId } });
        if (party?.status === "LOCKED") {
            return NextResponse.json({ success: false, error: "饭局已锁定，无法修改选择" }, { status: 403 });
        }

        if (action === "select") {
            // 检查是否已选
            const existing = await prisma.guestSelection.findUnique({
                where: { guestId_poolDishId: { guestId: guest.id, poolDishId } }
            });
            if (!existing) {
                await prisma.guestSelection.create({
                    data: { guestId: guest.id, poolDishId }
                });
            }
        } else if (action === "unselect") {
            await prisma.guestSelection.deleteMany({
                where: { guestId: guest.id, poolDishId }
            });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("选菜操作失败:", error);
        return NextResponse.json({ success: false, error: "操作失败" }, { status: 500 });
    }
}
