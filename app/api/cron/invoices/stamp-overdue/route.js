import { applyOverdueStamp } from "@/lib/cron/stampOverduePdf";
import { NextResponse } from "next/server";

const CRON_SECRET_KEY = process.env.CRON_SECRET_KEY;

function authenticateCron(req) {
  const provided = req.headers.get("x-cron-secret");
  if (!CRON_SECRET_KEY || provided !== CRON_SECRET_KEY) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  return null;
}

function parseOptions(req) {
  const url = new URL(req.url);
  const queryLimit = url.searchParams.get("limit");
  const queryDryRun = url.searchParams.get("dryRun");
  const queryConcurrency = url.searchParams.get("concurrency");
  const queryBatchSize = url.searchParams.get("batchSize");
  const limitFromQuery =
    queryLimit != null && queryLimit !== "" ? Number(queryLimit) : undefined;
  const dryRunFromQuery =
    queryDryRun === "1" || queryDryRun === "true" || queryDryRun === "yes";
  const concurrencyFromQuery = queryConcurrency
    ? Number(queryConcurrency)
    : undefined;

  return {
    limit: limitFromQuery,
    dryRun: dryRunFromQuery,
    concurrency: concurrencyFromQuery,
    batchSize: queryBatchSize ? Number(queryBatchSize) : undefined,
  };
}

async function run(req) {
  const authResponse = authenticateCron(req);
  if (authResponse) return authResponse;

  try {
    const jsonBody = await req.json().catch(() => ({}));
    const queryOptions = parseOptions(req);
    const limit =
      typeof jsonBody?.limit === "number"
        ? jsonBody.limit
        : jsonBody?.limit
        ? Number(jsonBody.limit)
        : queryOptions.limit;
    const dryRun =
      jsonBody?.dryRun != null ? !!jsonBody.dryRun : queryOptions.dryRun;
    const concurrency =
      typeof jsonBody?.concurrency === "number"
        ? jsonBody.concurrency
        : jsonBody?.concurrency
        ? Number(jsonBody.concurrency)
        : queryOptions.concurrency;
    const batchSize =
      typeof jsonBody?.batchSize === "number"
        ? jsonBody.batchSize
        : jsonBody?.batchSize
        ? Number(jsonBody.batchSize)
        : queryOptions.batchSize;

    const summary = await applyOverdueStamp({
      limit,
      dryRun,
      concurrency,
      batchSize,
    });

    return NextResponse.json({ ok: true, summary }, { status: 200 });
  } catch (error) {
    console.error("cron invoices/stamp-overdue error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal error",
      },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  return run(req);
}

export async function POST(req) {
  return run(req);
}
