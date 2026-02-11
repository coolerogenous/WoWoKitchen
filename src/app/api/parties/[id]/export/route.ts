import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { generateShoppingList } from "@/lib/calculation/aggregator";
import { DishWithIngredients } from "@/types";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/parties/[id]/export - 导出采购清单
 * 仅基于被宾客选中的菜品（至少有一人选择）
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const partyId = Number(id);

        // 鉴权：Host 或 Guest? 通常 Host 采购，但 Guest 获取清单也没问题。
        // 如果允许 Guest 查看，需要验证 guestToken? 为了方便，这里不做强制鉴权，或者只做 Host 鉴权。
        // PRD: "发起人...导出导出菜品清单详情以方便购买食材" -> 主要给 Host。
        // 但鉴于分享机制，开放给有链接的人查看也行。这里暂不强制 User Auth，但如果是 Host 更好。
        const userId = getUserIdFromRequest(req); // 尝试获取 User

        const party = await prisma.party.findUnique({
            where: { id: partyId },
            include: {
                host: { select: { username: true } },
                guests: true,
                poolDishes: {
                    include: {
                        selections: { include: { guest: { select: { nickname: true } } } }
                    }
                },
            },
        });

        if (!party) {
            return NextResponse.json({ success: false, error: "饭局不存在" }, { status: 404 });
        }

        // 筛选出至少有一人选择的菜品
        const selectedDishes = party.poolDishes.filter(d => d.selections.length > 0);

        // 转换为 DishWithIngredients 格式以便使用 aggregation 库
        const dishesForCalc: DishWithIngredients[] = selectedDishes.map(pd => {
            const ingredients = JSON.parse(pd.ingredientsSnapshot);
            return {
                id: pd.id,
                name: pd.dishName,
                estimatedCost: pd.costSnapshot,
                ingredients: ingredients.map((ing: any) => ({
                    quantity: ing.quantity,
                    unit: ing.unit,
                    ingredient: {
                        id: 0, // Snapshot so no real ID needed for calc
                        name: ing.name,
                        unitPrice: ing.unitPrice,
                        spec: ing.spec || "未知规格"
                    }
                })),
                userId: party.hostId, // phantom
                createdAt: new Date(),
                updatedAt: new Date()
            };
        });

        const shoppingList = generateShoppingList(dishesForCalc);

        const exportData = {
            partyName: party.name,
            hostName: party.host.username,
            status: party.status,
            guestCount: party.guests.length,
            guests: party.guests.map(g => g.nickname),
            dishes: selectedDishes.map(d => ({
                name: d.dishName,
                cost: d.costSnapshot,
                selectedBy: d.selections.map(s => s.guest.nickname)
            })),
            shoppingList
        };

        return NextResponse.json({ success: true, data: exportData });

    } catch (error) {
        console.error("导出清单失败:", error);
        return NextResponse.json({ success: false, error: "导出失败" }, { status: 500 });
    }
}
