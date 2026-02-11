import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth"; // 可选，如果需要导入时鉴权

/**
 * GET /api/share/[code] - 获取分享内容
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await params;
        const upperCode = code.toUpperCase();

        // 1. 检查是否为饭局
        const party = await prisma.party.findUnique({
            where: { shareCode: upperCode },
            include: { host: { select: { username: true } } },
        });

        if (party) {
            return NextResponse.json({
                success: true,
                data: {
                    type: "PARTY",
                    id: party.id,
                    name: party.name,
                    hostName: party.host.username,
                    status: party.status,
                },
            });
        }

        // 2. 检查 ShareToken
        const token = await prisma.shareToken.findUnique({
            where: { code: upperCode },
        });

        if (!token) {
            return NextResponse.json(
                { success: false, error: "无效的分享码" },
                { status: 404 }
            );
        }

        // 3. 根据类型返回详细数据（用于导入）
        let detailData = null;

        if (token.type === "DISH") {
            const dish = await prisma.dish.findUnique({
                where: { id: token.refId },
                include: {
                    ingredients: { include: { ingredient: true } },
                },
            });
            if (dish) {
                detailData = {
                    name: dish.name,
                    ingredients: dish.ingredients.map((di) => ({
                        name: di.ingredient.name,
                        quantity: di.quantity,
                        unit: di.unit,
                        unitPrice: di.ingredient.unitPrice,
                        spec: di.ingredient.spec,
                    })),
                };
            }
        } else if (token.type === "MENU") {
            const menu = await prisma.menu.findUnique({
                where: { id: token.refId },
                include: {
                    dishes: {
                        include: {
                            dish: {
                                include: {
                                    ingredients: { include: { ingredient: true } },
                                },
                            },
                        },
                    },
                },
            });
            if (menu) {
                detailData = {
                    name: menu.name,
                    dishes: menu.dishes.map((md) => ({
                        name: md.dish.name,
                        ingredients: md.dish.ingredients.map((di) => ({
                            name: di.ingredient.name,
                            quantity: di.quantity,
                            unit: di.unit,
                            unitPrice: di.ingredient.unitPrice,
                            spec: di.ingredient.spec,
                        })),
                    })),
                };
            }
        }

        if (!detailData) {
            // 数据可能已被源头删除
            return NextResponse.json(
                { success: false, error: "分享的内容已不存在" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                type: token.type,
                data: detailData,
            },
        });

    } catch (error) {
        console.error("获取分享内容失败:", error);
        return NextResponse.json(
            { success: false, error: "获取分享内容失败" },
            { status: 500 }
        );
    }
}
