import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/parties/[id]/join - 访客加入
 * body: { nickname }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { nickname } = body;

        // 支持 ID 或 ShareCode
        let partyId = Number(id);
        if (isNaN(partyId)) {
            const p = await prisma.party.findUnique({ where: { shareCode: id } });
            if (!p) return NextResponse.json({ success: false, error: "无效的饭局代码" }, { status: 404 });
            partyId = p.id;
        }

        if (!nickname) {
            return NextResponse.json({ success: false, error: "昵称不能为空" }, { status: 400 });
        }

        const guestToken = uuidv4();
        const guest = await prisma.partyGuest.create({
            data: {
                partyId,
                nickname,
                guestToken
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                guestId: guest.id,
                guestToken,
                nickname,
                partyId
            }
        });

    } catch (error) {
        console.error("加入饭局失败:", error);
        return NextResponse.json({ success: false, error: "加入失败" }, { status: 500 });
    }
}
