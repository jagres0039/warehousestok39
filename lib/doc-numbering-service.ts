// Document numbering service. Wraps the pure template engine with a
// transactional counter increment that respects each tenant's reset policy.

import type { Prisma, DocType } from "@prisma/client";
import { renderDocumentNumber, counterPeriodKey, type ResetPolicy } from "./doc-numbering";

interface IssueOpts {
  tx: Prisma.TransactionClient;
  organizationId: string;
  docType: DocType;
  orgCode?: string;
  now?: Date;
}

/**
 * Reserve the next document number for the given tenant + doc type.
 *
 * Must be called inside a Prisma transaction so the counter increment and the
 * downstream INSERT either both succeed or both roll back. Otherwise two
 * concurrent transactions could grab the same counter via a TOCTOU race.
 *
 * The function locks the DocNumberConfig row first (FOR UPDATE) before reading,
 * so concurrent issuers serialize on that single row.
 */
export async function issueDocumentNumber({
  tx,
  organizationId,
  docType,
  orgCode,
  now = new Date(),
}: IssueOpts): Promise<string> {
  await tx.$executeRaw`
    SELECT id FROM "DocNumberConfig"
    WHERE "organizationId" = ${organizationId} AND "docType"::text = ${docType}
    FOR UPDATE
  `;

  const config = await tx.docNumberConfig.findUnique({
    where: { organizationId_docType: { organizationId, docType } },
  });
  if (!config) {
    throw new Error(
      `DocNumberConfig missing for org=${organizationId} docType=${docType}`,
    );
  }

  const policy = config.resetPolicy as ResetPolicy;
  const period = counterPeriodKey(policy, now);

  const nextCounter =
    period === config.counterPeriod ? config.currentCounter + 1 : 1;

  await tx.docNumberConfig.update({
    where: { id: config.id },
    data: { currentCounter: nextCounter, counterPeriod: period },
  });

  return renderDocumentNumber({
    template: config.template,
    counter: nextCounter,
    now,
    orgCode,
  });
}
