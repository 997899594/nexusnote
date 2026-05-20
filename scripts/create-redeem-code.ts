import { randomBytes } from "node:crypto";
import { closeDbConnection, db, redeemCodes } from "@/db";
import { BillingPlanIdSchema, getBillingPlan } from "@/lib/billing/plans";
import { hashRedeemCode, normalizeRedeemCode } from "@/lib/billing/redeem-codes";

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function generateCode(): string {
  return randomBytes(12).toString("base64url").toUpperCase();
}

async function main() {
  const plan = BillingPlanIdSchema.parse(readArg("plan") ?? "pro_month");
  const billingPlan = getBillingPlan(plan);
  const code = normalizeRedeemCode(readArg("code") ?? generateCode());
  const days = Number(readArg("days") ?? billingPlan.entitlementDays);
  const maxRedemptions = Number(readArg("max") ?? 1);

  const [created] = await db
    .insert(redeemCodes)
    .values({
      codeHash: hashRedeemCode(code),
      plan,
      entitlementDays: days,
      maxRedemptions,
      metadata: {
        generatedBy: "scripts/create-redeem-code.ts",
      },
    })
    .returning({
      id: redeemCodes.id,
    });

  console.log(
    JSON.stringify(
      {
        id: created.id,
        code,
        plan,
        entitlementDays: days,
        maxRedemptions,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbConnection();
  });
